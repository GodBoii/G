"use client";

import { useId, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { Segmented } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import { NUMBER_RULES, describeNumberDraw, drawNumbers, numberMultiplierX100, settleNumbers, validNumberPick, type NumberGameKind, type SevenPick } from "@/lib/logic/numbers";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";

const SEVEN_OPTIONS = [
  { value: "down", label: "Under 7" },
  { value: "seven", label: "Exactly 7" },
  { value: "up", label: "Over 7" },
] satisfies { value: SevenPick; label: string }[];

export function NumberDrawGame({ kind }: { kind: NumberGameKind }) {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();
  const inputId = useId();
  const [number, setNumber] = useState("");
  const [sevenPick, setSevenPick] = useState<SevenPick>("down");
  const [draw, setDraw] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Choose your numbers, then draw"));
  const rules = NUMBER_RULES[kind];
  const isDice = kind === "seven-up-down";
  const pick = isDice ? sevenPick : number;
  const valid = validNumberPick(kind, pick);
  const multiplier = numberMultiplierX100(kind, pick);
  const chance = isDice && sevenPick === "seven" ? "6 in 36" : rules.chance;

  function onPlay() {
    if (!bet.valid || !valid || !lock.tryLock()) return;
    try {
      const outcome = drawNumbers(kind);
      const payoutX100 = settleNumbers(kind, pick, outcome);
      const ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, payoutX100, 100));
      if (!ticket) {
        setNotice("Not enough credits");
        lock.unlock();
        return;
      }
      setNotice(null);
      setDraw(null);
      setBanner((b) => ({ kind: "pending", title: isDice ? "Rolling…" : "Drawing…", round: b.round }));
      timers.setTimeout(() => {
        settle(ticket);
        setDraw(outcome);
        const multiplierText = formatMultiplier(payoutX100, 100);
        const detail = `Draw ${describeNumberDraw(kind, outcome)} · Your pick: ${pick}`;
        setBanner((b) => bannerFor({ ...ticket, multiplierText, round: b.round + 1, detail, outcome }));
        history.add({ ...ticket, label: detail, multiplierText });
        lock.unlock();
      }, reducedMotion ? 300 : 1400);
    } catch (error) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(error), round: b.round }));
      lock.unlock();
    }
  }

  const board = (
    <div className="flex flex-col items-center justify-center gap-6 py-8 sm:py-14" aria-busy={lock.busy}>
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-muted">{isDice ? "Two dice. One total." : "Your next draw"}</p>
      <div aria-hidden="true" className="flex gap-3 sm:gap-5">
        {Array.from({ length: rules.digits }, (_, index) => (
          <span key={index} className={`grid size-16 place-items-center rounded-2xl border border-amber-300/40 bg-amber-400/10 font-mono text-4xl font-bold text-amber-200 sm:size-24 sm:text-6xl ${lock.busy && !reducedMotion ? "animate-pulse" : ""}`}>
            {draw?.[index] ?? "?"}
          </span>
        ))}
      </div>
      <p data-testid="number-draw" className="min-h-7 font-mono text-xl font-semibold text-ink">
        {draw ? describeNumberDraw(kind, draw) : lock.busy ? "Drawing…" : isDice ? "? + ? = ?" : "?".repeat(rules.digits)}
      </p>
      <p className="max-w-sm text-center text-sm text-ink-muted">{rules.instruction}</p>
    </div>
  );

  const controls = (
    <BetControls bet={bet} inputDisabled={lock.busy} primaryDisabled={lock.busy || !bet.valid || !valid}
      primaryLabel={lock.busy ? "Drawing…" : isDice ? "Roll dice" : "Place bet & draw"} onPrimary={onPlay}
      potentialPayout={bet.valid && valid ? formatCredits(payoutFromMultiplier(bet.parsed, multiplier, 100)) : "—"}>
      {isDice ? (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-muted">Predict the total</p>
          <Segmented<SevenPick> label="Predict the total" options={SEVEN_OPTIONS} value={sevenPick} onChange={setSevenPick} disabled={lock.busy} className="[&>button]:min-h-11 [&>button]:px-2" />
        </div>
      ) : (
        <div>
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-muted">Your {rules.digits}-digit number</label>
          <input id={inputId} data-testid="number-pick" type="text" inputMode="numeric" autoComplete="off" maxLength={rules.digits}
            value={number} disabled={lock.busy} onChange={(event) => setNumber(event.target.value)}
            aria-invalid={number.length > 0 && !valid} aria-describedby={`${inputId}-help`}
            placeholder={kind === "jodi" ? "00" : "000"}
            className="min-h-12 w-full rounded-xl border border-white/15 bg-bg-950/60 px-4 py-3 font-mono text-xl tracking-widest text-ink disabled:opacity-50" />
          <p id={`${inputId}-help`} className={`mt-2 text-sm ${number.length > 0 && !valid ? "text-rose-300" : "text-ink-muted"}`}>
            Enter exactly {rules.digits} digits, from {"0".repeat(rules.digits)} to {"9".repeat(rules.digits)}.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Win pays" value={formatMultiplier(multiplier, 100)} tone="gold" />
        <StatTile label="Win chance" value={chance} />
      </div>
      {notice && <p role="alert" className="text-sm text-rose-300">{notice}</p>}
    </BetControls>
  );

  return <GameLayout boardLabel={isDice ? "Dice draw" : "Number draw"} board={board} controls={controls}
    result={<ResultBanner state={banner} />} history={<History entries={history.entries} />} />;
}
