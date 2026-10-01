"use client";

import { useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
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
import { COIN_PAYOUT_X100, coinMultiplierX100, flipCoin, nextCoinRotation, type CoinFace } from "@/lib/logic/coinflip";
import { formatCredits, formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";

const FLIP_MS = 1600;
const SETTLE_MS = 1700;
const REDUCED_FLIP_MS = 250;
const REDUCED_SETTLE_MS = 300;

const FACE_NAME: Record<CoinFace, string> = { heads: "Heads", tails: "Tails" };
const FACE_ICON: Record<CoinFace, string> = { heads: "👑", tails: "⭐" };

const SIDE_OPTIONS: readonly SegmentedOption<CoinFace>[] = [
  { value: "heads", label: "👑 Heads", testId: "pick-heads" },
  { value: "tails", label: "⭐ Tails", testId: "pick-tails" },
];

export function CoinFlipGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();

  const [pick, setPick] = useState<CoinFace>("heads");
  const [rotation, setRotation] = useState(0);
  const [flipMs, setFlipMs] = useState(FLIP_MS);
  const [tossing, setTossing] = useState(false);
  /** Landed face, set at settle (data-face). */
  const [face, setFace] = useState<CoinFace | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Call it, then flip"));

  function onPlay() {
    if (!bet.valid || !lock.tryLock()) return;
    const reduced = reducedMotion;
    const picked = pick;
    let ticket: Ticket | null;
    let landed: CoinFace;
    let multX100: number;
    try {
      landed = flipCoin();
      multX100 = coinMultiplierX100(picked, landed);
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, multX100, 100));
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
    setLastWin(null);
    setFlipMs(reduced ? REDUCED_FLIP_MS : FLIP_MS);
    setRotation((r) => nextCoinRotation(r, landed));
    setTossing(!reduced);
    setBanner((b) => ({ kind: "pending", title: "Flipping…", round: b.round }));

    timers.setTimeout(
      () => {
        settle(ticket);
        setTossing(false);
        setFace(landed);
        setLastWin(ticket.payoutCents > 0);
        setBanner((b) =>
          bannerFor({
            betCents: ticket.betCents,
            payoutCents: ticket.payoutCents,
            multiplierText: formatMultiplier(multX100, 100),
            round: b.round + 1,
            detail: `Landed on ${FACE_NAME[landed]} · you picked ${FACE_NAME[picked]}`,
            outcome: landed,
          }),
        );
        history.add({
          id: ticket.id,
          label: `${FACE_ICON[landed]} ${FACE_NAME[landed]}`,
          multiplierText: formatMultiplier(multX100, 100),
          betCents: ticket.betCents,
          payoutCents: ticket.payoutCents,
        });
        lock.unlock();
      },
      reduced ? REDUCED_SETTLE_MS : SETTLE_MS,
    );
  }

  const potential = bet.valid ? formatCredits(payoutFromMultiplier(bet.parsed, COIN_PAYOUT_X100, 100)) : "—";

  const board = (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-6 sm:py-10">
      <div className="relative grid w-full place-items-center">
        {/* Soft spotlight behind the coin. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute size-64 rounded-full blur-3xl transition-colors duration-700 sm:size-80 ${
            lastWin === true ? "bg-emerald-400/25" : lastWin === false ? "bg-rose-500/15" : "bg-amber-400/15"
          }`}
        />
        <div
          className={`relative ${tossing ? "animate-coin-toss" : ""}`}
          style={tossing ? { animationDuration: `${FLIP_MS}ms` } : undefined}
        >
          <div className="[perspective:1000px]">
            <div
              data-testid="coin"
              data-face={face ?? undefined}
              role="img"
              aria-label={face ? `Coin showing ${FACE_NAME[face]}` : "Coin"}
              className="relative size-40 [transform-style:preserve-3d] sm:size-52"
              style={{
                transform: `rotateY(${rotation}deg)`,
                transition: `transform ${flipMs}ms cubic-bezier(.2,.8,.2,1)`,
              }}
            >
              <CoinFaceView side="heads" />
              <CoinFaceView side="tails" />
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="mt-6 h-4 w-32 rounded-[50%] bg-black/60 blur-sm sm:w-40"
          style={tossing ? { animation: `coin-shadow ${FLIP_MS}ms cubic-bezier(.33,0,.2,1)` } : { opacity: 0.55 }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-muted">
        <span>You picked</span>
        <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 font-semibold text-amber-200">
          {FACE_ICON[pick]} {FACE_NAME[pick]}
        </span>
        {face && (
          <>
            <span aria-hidden="true">·</span>
            <span>Last flip</span>
            <span
              className={`rounded-full border px-3 py-1 font-semibold ${
                lastWin ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-rose-400/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {FACE_ICON[face]} {FACE_NAME[face]}
            </span>
          </>
        )}
      </div>
    </div>
  );

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={lock.busy}
      primaryLabel={lock.busy ? "Flipping…" : "Flip coin"}
      onPrimary={onPlay}
      potentialPayout={potential}
    >
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-muted">Your call</p>
        <Segmented<CoinFace> label="Pick a side" options={SIDE_OPTIONS} value={pick} onChange={setPick} disabled={lock.busy} />
      </div>
      <StatTile label="Multiplier" value={formatMultiplier(COIN_PAYOUT_X100, 100)} tone="gold" />
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Coin"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}

function CoinFaceView({ side }: { side: CoinFace }) {
  const heads = side === "heads";
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full border-4 [backface-visibility:hidden] ${
        heads
          ? "border-amber-200/80 bg-[radial-gradient(circle_at_35%_30%,#fef3c7_0%,#fbbf24_35%,#b45309_100%)] text-amber-950 shadow-[0_0_40px_-6px_rgb(251_191_36/.7),inset_0_-8px_16px_rgb(120_53_15/.45),inset_0_8px_16px_rgb(255_255_255/.35)]"
          : "border-violet-200/70 bg-[radial-gradient(circle_at_35%_30%,#f5f3ff_0%,#c4b5fd_35%,#5b21b6_100%)] text-violet-950 shadow-[0_0_40px_-6px_rgb(167_139_250/.7),inset_0_-8px_16px_rgb(46_16_101/.45),inset_0_8px_16px_rgb(255_255_255/.35)] [transform:rotateY(180deg)]"
      }`}
    >
      <span className="pointer-events-none absolute inset-3 rounded-full border-2 border-dashed border-current opacity-30" />
      <span className="text-5xl drop-shadow sm:text-6xl">{heads ? "👑" : "⭐"}</span>
      <span className="font-display text-sm font-extrabold tracking-[0.3em] sm:text-base">{heads ? "HEADS" : "TAILS"}</span>
    </div>
  );
}
