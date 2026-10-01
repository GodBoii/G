"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { Button } from "@/components/ui/Button";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { Segmented, type SegmentedOption } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import {
  MATKA_BET_LABELS,
  MATKA_BET_TYPES,
  MATKA_PAYOUTS,
  ankOf,
  classifyPanna,
  drawMatka,
  formatMatkaResult,
  jodiOf,
  settleMatka,
  validateMatkaInput,
  type MatkaBet,
  type MatkaBetType,
  type MatkaResult,
  type MatkaSide,
} from "@/lib/logic/matka";
import { MATKA_KEY, matkaHistoryStore, type MatkaChartItem } from "@/lib/matkaHistoryStore";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage, randomInt } from "@/lib/rng";
import { safeRead } from "@/lib/storage";

const TICK_MS = 60;
const LOCK_STEP_MS = 300;
const SLOT_COUNT = 8; // open panna (3) · open ank · close ank · close panna (3)
const SETTLE_MS = LOCK_STEP_MS * SLOT_COUNT + 200; // ≈ 2.6 s
const REDUCED_SETTLE_MS = 300;
const PLACEHOLDER = "???-??-???";
const IDLE_DIGITS: readonly string[] = Array.from({ length: SLOT_COUNT }, () => "?");
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const TYPE_OPTIONS: readonly SegmentedOption<MatkaBetType>[] = MATKA_BET_TYPES.map((t) => ({
  value: t,
  label: MATKA_BET_LABELS[t],
  testId: `matka-type-${t}`,
}));

const SIDE_OPTIONS: readonly SegmentedOption<MatkaSide>[] = [
  { value: "open", label: "Open", testId: "matka-side-open" },
  { value: "close", label: "Close", testId: "matka-side-close" },
];

const SIDE_LABEL: Record<MatkaSide, string> = { open: "Open", close: "Close" };
const CLASS_LABEL = { single: "Single Panna", double: "Double Panna", triple: "Triple Panna" } as const;

function finalDigits(r: MatkaResult): string[] {
  return [...r.open.split(""), ...jodiOf(r).split(""), ...r.close.split("")];
}

function describeBet(bet: MatkaBet): string {
  if (bet.type === "jodi") return `Jodi ${bet.value}`;
  return `${MATKA_BET_LABELS[bet.type]} ${SIDE_LABEL[bet.side as MatkaSide]} ${bet.value}`;
}

/** Ticker slot indexes that won for a bet (outlined in emerald). */
function winningSlots(bet: MatkaBet): number[] {
  if (bet.type === "jodi") return [3, 4];
  if (bet.type === "single") return bet.side === "open" ? [3] : [4];
  return bet.side === "open" ? [0, 1, 2] : [5, 6, 7];
}

const getServerChart = (): readonly MatkaChartItem[] | null => null;

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function SattaMatkaGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();
  const inputId = useId();
  const inputErrId = `${inputId}-error`;
  const inputHelpId = `${inputId}-help`;

  const chart = useSyncExternalStore(matkaHistoryStore.subscribe, matkaHistoryStore.getSnapshot, getServerChart);
  useEffect(() => {
    matkaHistoryStore.hydrate(safeRead(MATKA_KEY));
  }, []);

  const [betType, setBetType] = useState<MatkaBetType>("single");
  const [side, setSide] = useState<MatkaSide>("open");
  const [digit, setDigit] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [ticker, setTicker] = useState<readonly string[]>(IDLE_DIGITS);
  const [lockedCount, setLockedCount] = useState(0);
  const [settled, setSettled] = useState<{ result: MatkaResult; winSlots: number[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Choose a bet and draw"));

  const busy = lock.busy;
  const selection =
    betType === "single"
      ? digit === null
        ? ({ ok: false, error: "Pick a digit from 0 to 9" } as const)
        : validateMatkaInput("single", digit)
      : validateMatkaInput(betType, text);
  const payoutX = MATKA_PAYOUTS[betType];
  const potential = bet.valid ? formatCredits(payoutFromMultiplier(bet.parsed, payoutX, 1)) : "—";
  const maxLength = betType === "jodi" ? 2 : 3;
  const showInputError = betType !== "single" && edited && !selection.ok;

  function onTypeChange(t: MatkaBetType) {
    if (t === betType) return;
    setBetType(t);
    setText("");
    setEdited(false);
  }

  function onPlay() {
    if (!bet.valid || !selection.ok || !lock.tryLock()) return;
    const reduced = reducedMotion;
    const matkaBet: MatkaBet = { type: betType, side: betType === "jodi" ? null : side, value: selection.value };
    let ticket: Ticket | null;
    let result: MatkaResult;
    let mult: number;
    try {
      result = drawMatka();
      mult = settleMatka(matkaBet, result);
      const at = Date.now();
      const drawn = result;
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, mult, 1), () =>
        matkaHistoryStore.append({ open: drawn.open, close: drawn.close, at }),
      );
    } catch (e) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(e), round: b.round }));
      console.error(e);
      lock.unlock();
      return;
    }
    if (!ticket) {
      setNotice("Not enough credits");
      lock.unlock();
      return;
    }

    setNotice(null);
    setSettled(null);
    setBanner((b) => ({ kind: "pending", title: "Drawing…", round: b.round }));
    const target = finalDigits(result);

    if (reduced) {
      setTicker(target);
      setLockedCount(SLOT_COUNT);
    } else {
      // Ticker: filler digits every 60 ms; one slot locks to the real digit every 300 ms, in order.
      let locked = 0;
      setLockedCount(0);
      const roll = () => {
        if (locked >= SLOT_COUNT) return;
        setTicker(target.map((d, i) => (i < locked ? d : String(randomInt(0, 9)))));
        timers.setTimeout(roll, TICK_MS);
      };
      roll();
      for (let i = 1; i <= SLOT_COUNT; i++) {
        timers.setTimeout(() => {
          locked = i;
          setLockedCount(i);
          if (i === SLOT_COUNT) setTicker(target);
        }, LOCK_STEP_MS * i);
      }
    }

    timers.setTimeout(
      () => {
        settle(ticket); // credits and appends the chart row (onSettle) in the same call
        setTicker(target);
        setLockedCount(SLOT_COUNT);
        setSettled({ result, winSlots: mult > 0 ? winningSlots(matkaBet) : [] });
        const multText = formatMultiplier(mult, 1);
        const desc = describeBet(matkaBet);
        setBanner((b) =>
          bannerFor({
            betCents: ticket.betCents,
            payoutCents: ticket.payoutCents,
            multiplierText: multText,
            round: b.round + 1,
            detail: `Result ${formatMatkaResult(result)} · ${desc}`,
          }),
        );
        history.add({
          id: ticket.id,
          label: `🃏 ${desc}`,
          multiplierText: multText,
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
        });
        lock.unlock();
      },
      reduced ? REDUCED_SETTLE_MS : SETTLE_MS,
    );
  }

  const winSet = new Set(settled?.winSlots ?? []);
  const drawing = busy && settled === null;

  function slot(i: number) {
    const isLocked = !drawing || i < lockedCount;
    const win = winSet.has(i);
    return (
      <span
        key={i}
        className={`grid h-10 w-7 place-items-center rounded-md border font-mono text-xl font-bold tabular-nums transition-colors min-[400px]:h-12 min-[400px]:w-9 min-[400px]:rounded-lg min-[400px]:text-2xl sm:h-16 sm:w-12 sm:text-4xl ${
          win
            ? "border-emerald-300 bg-emerald-400/20 text-emerald-200 shadow-glow-emerald"
            : isLocked && ticker[i] !== "?"
              ? "border-amber-300/50 bg-linear-to-b from-bg-700 to-bg-900 text-amber-200 shadow-glow-amber"
              : "border-white/10 bg-linear-to-b from-bg-700 to-bg-900 text-ink-muted"
        }`}
      >
        {ticker[i]}
      </span>
    );
  }

  const board = (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        <p>
          <span aria-hidden="true">⚠️ </span>
          Simulation only. A random number game with demo credits. No real markets, timings, or money.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div aria-hidden="true" className="flex max-w-full items-end justify-center gap-1 min-[400px]:gap-1.5 sm:gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink-faint">Open</span>
            <div className="flex gap-1 sm:gap-1.5">{[0, 1, 2].map(slot)}</div>
          </div>
          <span className="pb-3 text-xl text-ink-faint sm:pb-5">–</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink-faint">Jodi</span>
            <div className="flex gap-1 sm:gap-1.5">{[3, 4].map(slot)}</div>
          </div>
          <span className="pb-3 text-xl text-ink-faint sm:pb-5">–</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-ink-faint">Close</span>
            <div className="flex gap-1 sm:gap-1.5">{[5, 6, 7].map(slot)}</div>
          </div>
        </div>
        <p className="text-sm text-ink-muted">
          Result:{" "}
          <span
            data-testid="matka-result"
            data-settled={settled ? "true" : "false"}
            className="font-mono text-base font-semibold tabular-nums text-ink"
          >
            {settled ? formatMatkaResult(settled.result) : PLACEHOLDER}
          </span>
        </p>
      </div>
    </div>
  );

  let helper: string | null = null;
  if (betType !== "single" && selection.ok) {
    helper =
      betType === "jodi"
        ? `Open ank ${selection.value[0]} · Close ank ${selection.value[1]}`
        : `Canonical: ${selection.value} · ${CLASS_LABEL[classifyPanna(selection.value)]}`;
  }
  const describedBy = [showInputError && inputErrId, helper && inputHelpId].filter(Boolean).join(" ") || undefined;

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={lock.busy}
      primaryDisabled={lock.busy || !bet.valid || !selection.ok}
      primaryLabel={lock.busy ? "Drawing…" : "Place bet & draw"}
      onPrimary={onPlay}
      potentialPayout={potential}
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-muted">Bet type</p>
        <Segmented<MatkaBetType>
          label="Bet type"
          options={TYPE_OPTIONS}
          value={betType}
          onChange={onTypeChange}
          disabled={busy}
          className="flex-wrap [&>button]:basis-[30%] [&>button]:px-2"
        />
      </div>

      {betType !== "jodi" && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-muted">Side</p>
          <Segmented<MatkaSide> label="Side" options={SIDE_OPTIONS} value={side} onChange={setSide} disabled={busy} />
        </div>
      )}

      {betType === "single" ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-muted">Digit</p>
          <div role="group" aria-label="Digit" className="grid grid-cols-5 gap-1.5">
            {DIGITS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={digit === d}
                data-testid={`matka-digit-${d}`}
                disabled={busy}
                onClick={() => setDigit(d)}
                className={`h-11 rounded-lg font-mono text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  digit === d
                    ? "bg-linear-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow-fuchsia"
                    : "border border-white/10 bg-white/5 text-ink enabled:hover:bg-white/10"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {digit === null && <p className="mt-1.5 text-sm text-ink-muted">Pick a digit from 0 to 9</p>}
        </div>
      ) : (
        <div>
          <label htmlFor={inputId} className="text-sm font-medium text-ink-muted">
            {betType === "jodi" ? "Jodi (2 digits)" : `${MATKA_BET_LABELS[betType]} (3 digits)`}
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={maxLength}
            data-testid="matka-number"
            value={text}
            disabled={busy}
            placeholder={betType === "jodi" ? "e.g. 05" : betType === "singlePanna" ? "e.g. 127" : betType === "doublePanna" ? "e.g. 112" : "e.g. 777"}
            aria-invalid={showInputError ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => {
              setText(e.target.value.replace(/\D/g, "").slice(0, maxLength));
              setEdited(true);
            }}
            className={`mt-1.5 h-11 w-full rounded-xl border bg-bg-950/70 px-3 font-mono text-lg font-semibold tracking-[0.3em] tabular-nums text-ink placeholder:tracking-normal placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60 ${
              showInputError ? "border-rose-400/70" : "border-white/10 hover:border-white/20"
            }`}
          />
          {showInputError && !selection.ok && (
            <p id={inputErrId} role="alert" className="mt-1.5 text-sm text-rose-300">
              {selection.error}
            </p>
          )}
          {helper && (
            <p id={inputHelpId} className="mt-1.5 text-sm text-emerald-200">
              {helper}
            </p>
          )}
        </div>
      )}

      <StatTile label="Pays" value={formatMultiplier(payoutX, 1)} tone="gold" testId="matka-pays" />

      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  const latestN = chart && chart.length > 0 ? chart[0].n : null;

  const historyPanel = (
    <div className="flex flex-col gap-6">
      <History entries={history.entries} title="Your bets" />
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">Result chart</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => matkaHistoryStore.clear()}
            disabled={!chart || chart.length === 0}
          >
            Clear chart
          </Button>
        </div>
        {chart === null ? (
          <p className="mt-2 text-sm text-ink-faint">Loading chart…</p>
        ) : chart.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">No draws yet</p>
        ) : (
          <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-bg-800 text-left text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Time</th>
                  <th scope="col" className="px-3 py-2 font-medium">Open</th>
                  <th scope="col" className="px-3 py-2 font-medium">Jodi</th>
                  <th scope="col" className="px-3 py-2 font-medium">Close</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {chart.map((item) => (
                  <tr
                    key={item.n}
                    data-testid="matka-chart-row"
                    className={`border-t border-white/5 ${item.n === latestN ? "bg-amber-400/10 text-amber-100" : "text-ink"}`}
                  >
                    <td className="px-3 py-1.5 text-ink-faint">{item.n}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-sans text-ink-muted">{formatTime(item.at)}</td>
                    <td className="px-3 py-1.5">{item.open}</td>
                    <td className="px-3 py-1.5 font-semibold">{`${ankOf(item.open)}${ankOf(item.close)}`}</td>
                    <td className="px-3 py-1.5">{item.close}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <GameLayout
      boardLabel="Satta Matka draw"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={historyPanel}
    />
  );
}
