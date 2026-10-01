"use client";

import { useRef, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { Button } from "@/components/ui/Button";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import {
  SCRATCH_EMOJI,
  SCRATCH_NAMES,
  SCRATCH_PRIZES_X100,
  SCRATCH_SYMBOLS,
  evaluateCard,
  generateCard,
  type ScratchSymbol,
} from "@/lib/logic/scratch";
import { formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";
import { ScratchCanvas } from "./ScratchCanvas";

const FADE_MS = 300;

interface Card {
  cells: ScratchSymbol[];
  prize: ScratchSymbol | null;
  winningCells: number[];
  ticket: Ticket;
}

export function ScratchGame() {
  const bet = useBetInput();
  const lock = useRoundLock();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();

  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  /** A "Reveal all" fade is running. */
  const [fading, setFading] = useState(false);
  const [fadeMs, setFadeMs] = useState(FADE_MS);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Buy a card and scratch it"));
  // Exactly-once settlement guard for the current card (handlers/timers only).
  const revealedRef = useRef(true);

  function onBuy() {
    if (!bet.valid || !lock.tryLock()) return;
    let ticket: Ticket | null;
    let next: ReturnType<typeof generateCard>;
    try {
      next = generateCard();
      const prize = evaluateCard(next.cells);
      ticket = stake(bet.parsed, prize ? payoutFromMultiplier(bet.parsed, SCRATCH_PRIZES_X100[prize], 100) : 0);
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

    // The lock stays held until the card is revealed (Buy and the bet controls stay disabled).
    revealedRef.current = false;
    setNotice(null);
    setCard({ cells: next.cells, prize: evaluateCard(next.cells), winningCells: next.winningCells, ticket });
    setRevealed(false);
    setFading(false);
    setFadeMs(reducedMotion ? 0 : FADE_MS);
    setBanner((b) => ({ kind: "pending", title: "Scratch the card…", round: b.round }));
  }

  function finishReveal(c: Card) {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const { ticket, prize } = c;
    settle(ticket);
    setRevealed(true);
    setFading(false);
    const multText = formatMultiplier(prize ? SCRATCH_PRIZES_X100[prize] : 0, 100);
    setBanner((b) =>
      bannerFor({
        betCents: ticket.betCents,
        payoutCents: ticket.payoutCents,
        multiplierText: multText,
        round: b.round + 1,
        detail: prize ? `3× ${SCRATCH_EMOJI[prize]} ${SCRATCH_NAMES[prize]}` : "No match",
      }),
    );
    history.add({
      id: ticket.id,
      label: prize ? `🎟️ 3× ${SCRATCH_EMOJI[prize]}` : "🎟️ No match",
      multiplierText: multText,
      betCents: ticket.betCents,
      payoutCents: ticket.payoutCents,
    });
    lock.unlock();
  }

  /** Auto-reveal from the canvas (≥ 55% scratched). */
  function onScratchedEnough() {
    if (card) finishReveal(card);
  }

  function onRevealAll() {
    if (!card || revealedRef.current || fading) return;
    const c = card;
    if (reducedMotion) {
      finishReveal(c);
      return;
    }
    setFadeMs(FADE_MS);
    setFading(true);
    timers.setTimeout(() => finishReveal(c), FADE_MS);
  }

  const covered = card !== null && !revealed;
  const winSet = new Set(revealed && card ? card.winningCells : []);

  const board = (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full max-w-[24rem] rounded-[1.5rem] bg-linear-to-br from-emerald-400 via-teal-400 to-cyan-500 p-[2px] shadow-glow-emerald">
        <div className="rounded-[calc(1.5rem-2px)] bg-bg-900 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="whitespace-nowrap font-display text-base font-extrabold tracking-wide text-emerald-300 sm:text-lg">
              LUCKY SCRATCH
            </p>
            <p className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint sm:text-xs">
              Match 3 to win
            </p>
          </div>

          <div className="relative aspect-square w-full">
            {card ? (
              <>
                <div className="grid size-full grid-cols-3 gap-2 rounded-xl bg-bg-950/80 p-2">
                  {card.cells.map((s, i) => {
                    const win = winSet.has(i);
                    return (
                      <div
                        key={i}
                        data-testid="scratch-cell"
                        data-index={i}
                        data-symbol={revealed ? s : undefined}
                        data-win={revealed && win ? "true" : undefined}
                        role="img"
                        aria-label={revealed ? SCRATCH_NAMES[s] : "Hidden"}
                        className={`grid min-w-0 place-items-center rounded-lg border text-4xl transition-[opacity,box-shadow] duration-300 sm:text-5xl ${
                          win
                            ? "border-emerald-300 bg-emerald-400/20 shadow-glow-emerald animate-win-glow"
                            : revealed && card.prize
                              ? "border-white/5 bg-white/5 opacity-50"
                              : "border-white/10 bg-white/5"
                        }`}
                      >
                        <span aria-hidden="true">{SCRATCH_EMOJI[s]}</span>
                      </div>
                    );
                  })}
                </div>
                <ScratchCanvas key={card.ticket.id} onReveal={onScratchedEnough} cleared={revealed || fading} fadeMs={fadeMs} />
              </>
            ) : (
              <div className="grid size-full place-items-center rounded-xl border border-dashed border-emerald-300/30 bg-[repeating-linear-gradient(45deg,rgb(52_211_153/.06)_0_12px,transparent_12px_24px)] p-6 text-center">
                <div>
                  <p aria-hidden="true" className="text-6xl motion-safe:animate-float">
                    🎟️
                  </p>
                  <p className="mt-3 font-display text-xl font-bold text-ink">Buy a card to play</p>
                  <p className="mt-1 text-sm text-ink-muted">Then scratch the foil or press Reveal all.</p>
                </div>
              </div>
            )}
          </div>

          <Button
            data-testid="scratch-reveal"
            className="mt-4"
            block
            onClick={onRevealAll}
            disabled={!covered || fading}
          >
            ✨ Reveal all
          </Button>
        </div>
      </div>

      <ul className="grid w-full max-w-[24rem] grid-cols-3 gap-2 text-xs" aria-label="Prizes for three matching symbols">
        {SCRATCH_SYMBOLS.map((s) => (
          <li
            key={s}
            className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 tabular-nums ${
              revealed && card?.prize === s ? "border-emerald-300/70 bg-emerald-400/15" : "border-white/10 bg-white/5"
            }`}
          >
            <span aria-hidden="true">{SCRATCH_EMOJI[s]}</span>
            <span className="sr-only">{SCRATCH_NAMES[s]}</span>
            <span className="font-semibold text-ink">{formatMultiplier(SCRATCH_PRIZES_X100[s], 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={lock.busy}
      primaryLabel="Buy card"
      primaryTestId="scratch-buy"
      onPrimary={onBuy}
    >
      {covered && <p className="text-sm text-ink-muted">Scratch at least half of the foil, or press Reveal all, to finish this card.</p>}
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Scratch card"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
