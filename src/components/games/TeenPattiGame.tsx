"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import { compareHands, dealHands, HAND_RANKS, handName } from "@/lib/logic/teenPatti";
import { formatCredits } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";
import { ChipPicker } from "./ChipPicker";
import { TableHeading } from "./TableHeading";

const suitMarks = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const faceRanks: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const rankNames: Record<number, string> = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" };
const cardPositions = ["left", "middle", "right"];

type Hand = ReturnType<typeof dealHands>;
type Round = Hand & { tickets: readonly Ticket[]; comparison: number; seen: boolean };
type Result = "win" | "loss" | "push" | "fold";
type Stage =
  | { kind: "ready" }
  | { kind: "dealing" | "playing" | "showing"; round: Round }
  | { kind: "finished"; round: Round; result: Result };

const resultTitles: Record<Result, string> = {
  win: "You win", loss: "Dealer wins", push: "Tie · stake returned", fold: "You folded",
};

function HandDisplay({ label, cards, dealing }: { label: string; cards: Hand["player"] | null; dealing: boolean }) {
  return (
    <div className="hand">
      <div className="hand-label"><strong>{label}</strong><span>{cards ? handName(cards) : "Face down"}</span></div>
      <div className={`hand-cards${dealing ? " is-dealing" : ""}`}>
        {cardPositions.map((position, index) => {
          const card = cards?.[index];
          if (!card) {
            return <span className="playing-card card-back" key={position} role="img" aria-label="Face-down card">
              <span aria-hidden="true">♠</span>
            </span>;
          }
          const mark = suitMarks[card.suit];
          const rank = faceRanks[card.rank] ?? card.rank;
          const red = card.suit === "hearts" || card.suit === "diamonds";
          return (
            <span className={`playing-card card-face${red ? " red-card" : ""}`}
              key={`${position}-face`} role="img" aria-label={`${rankNames[card.rank] ?? card.rank} of ${card.suit}`}>
              <span className="card-corner" aria-hidden="true">{rank}<small>{mark}</small></span>
              <span className="card-suit" aria-hidden="true">{mark}</span>
              <span className="card-corner corner-bottom" aria-hidden="true">{rank}<small>{mark}</small></span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TeenPattiGame() {
  const { balanceCents } = useWallet();
  const { tryLock, unlock } = useRoundLock();
  const { stake, settle, forfeit } = useSettlement();
  const timers = useTimers();
  const reducedMotion = useReducedMotion();
  const history = useHistory<{ id: number; result: Result; net: number }>();
  const [amount, setAmount] = useState(10);
  const [stage, setStage] = useState<Stage>({ kind: "ready" });
  const [error, setError] = useState("");

  const round = stage.kind === "ready" ? null : stage.round;
  const reveal = stage.kind === "showing" || (stage.kind === "finished" && stage.result !== "fold");
  const stakeCents = round?.tickets.reduce((total, ticket) => total + ticket.betCents, 0) ?? 0;
  const canDeal = stage.kind === "ready" || stage.kind === "finished";
  const anteCents = amount * 100;
  const canAfford = balanceCents !== null && balanceCents >= anteCents;

  function deal() {
    if (!canDeal || !tryLock()) return;
    setError("");
    try {
      const hands = dealHands();
      const comparison = compareHands(hands.player, hands.dealer);
      const ticket = stake(anteCents, (1 + comparison) * anteCents);
      if (!ticket) {
        setError("Choose a smaller ante or add chips.");
        unlock();
        return;
      }

      const next = { ...hands, tickets: [ticket], comparison, seen: false };
      function finishDeal() {
        setStage({ kind: "playing", round: next });
        unlock();
      }
      if (reducedMotion) {
        finishDeal();
      } else {
        setStage({ kind: "dealing", round: next });
        timers.setTimeout(finishDeal, 460);
      }
    } catch (failure) {
      setError(playErrorMessage(failure));
      unlock();
    }
  }

  function raise() {
    if (stage.kind !== "playing" || stage.round.tickets.length > 1 || !tryLock()) return;
    const { round } = stage;
    const raiseCents = round.tickets[0].betCents;
    const ticket = stake(raiseCents, (1 + round.comparison) * raiseCents);
    if (ticket) {
      setStage({ kind: "playing", round: { ...round, tickets: [...round.tickets, ticket] } });
    } else {
      setError("Add chips to match the ante.");
    }
    unlock();
  }

  function finish(fold: boolean) {
    if (stage.kind !== "playing" || !tryLock()) return;
    const { round } = stage;
    const result = fold ? "fold" : round.comparison > 0 ? "win" : round.comparison < 0 ? "loss" : "push";
    setError("");

    function complete() {
      let payout = 0;
      for (const ticket of round.tickets) {
        if (fold) forfeit(ticket);
        else {
          settle(ticket);
          payout += ticket.payoutCents;
        }
      }
      history.add({ id: round.tickets[0].id, result, net: payout - stakeCents });
      setStage({ kind: "finished", round, result });
      unlock();
    }

    if (fold || reducedMotion) {
      complete();
    } else {
      setStage({ kind: "showing", round });
      timers.setTimeout(complete, 440);
    }
  }

  const message = stage.kind === "finished" ? resultTitles[stage.result] :
    stage.kind === "showing" ? "Comparing hands…" :
    stage.kind === "dealing" ? "Dealing cards…" :
    stage.kind === "playing" ? (round?.seen ? "Choose your move" : "Your hand is ready") : "Ready to deal";

  return (
    <>
      <TableHeading title="Teen Patti" description="Three-card showdown against the house dealer." icon="♠" />
      <div className="game-grid">
        <section className="game-surface patti-surface" aria-label="Teen Patti table">
          <div className="surface-caption"><span>HOUSE 37 &nbsp;/&nbsp; TEEN PATTI</span><span>HEADS UP</span></div>
          <div className="felt">
            <div className="felt-stamp" aria-hidden="true">♠</div>
            <HandDisplay label="Dealer" cards={reveal && round ? round.dealer : null} dealing={stage.kind === "dealing"} />
            <div className="pot">
              <span className="chip-symbol" aria-hidden="true">✦</span>
              <div><small>TABLE POT</small><strong>{formatCredits(stakeCents * 2)}</strong></div>
            </div>
            <HandDisplay label="Your hand" cards={round && (round.seen || reveal) ? round.player : null}
              dealing={stage.kind === "dealing"} />
          </div>
          <div className="table-status" role="status" data-outcome={stage.kind === "finished" ? stage.result : undefined}>
            <strong>{message}</strong>
            <span>{stage.kind === "finished" && stage.result === "win" ? `+${formatCredits(stakeCents)} chips` :
              stage.kind === "finished" && stage.result !== "push" ? `−${formatCredits(stakeCents)} chips` :
              stage.kind === "ready" ? "Select an ante to start." : " "}</span>
          </div>
        </section>

        <aside className="game-controls" aria-label="Teen Patti controls">
          <section className="control-panel">
            <h2>Your move</h2>
            <ChipPicker label="Table ante" value={amount} onChange={(value) => { setAmount(value); setError(""); }}
              disabled={!canDeal} />
            <div className="amount-line"><span>{canDeal ? "Ante" : "Your stake"}</span>
              <strong>{formatCredits(canDeal ? anteCents : stakeCents)} chips</strong></div>
            {canDeal || stage.kind !== "playing" ? (
              <button className="primary game-primary" type="button" onClick={deal} disabled={!canDeal || !canAfford}>
                {stage.kind === "dealing" ? "Dealing…" : stage.kind === "showing" ? "Showdown…" :
                  stage.kind === "finished" ? "Deal again" : "Deal cards"} <span aria-hidden="true">♠</span>
              </button>
            ) : (
              <div className="move-grid">
                <button type="button" className="primary game-primary" onClick={() => finish(false)}>Show hands <span aria-hidden="true">♠</span></button>
                {!stage.round.seen && (
                  <button type="button" className="secondary" onClick={() =>
                    setStage({ kind: "playing", round: { ...stage.round, seen: true } })}>See cards</button>
                )}
                <button type="button" className="secondary" onClick={raise}
                  disabled={stage.round.tickets.length > 1 || (balanceCents ?? 0) < anteCents}>
                  {stage.round.tickets.length > 1 ? "Raised" : "Chaal · raise"}
                </button>
                <button type="button" className="secondary fold" onClick={() => finish(true)}>Fold</button>
              </div>
            )}
            <p className="control-hint" role="status">{error || (canDeal && balanceCents !== null && !canAfford ?
              "Add chips or choose a smaller ante." : canDeal ? "The dealer matches your ante." :
              "The dealer matches one raise per hand.")}</p>
          </section>

          <section className="control-panel compact">
            <h2>Recent hands</h2>
            {history.entries.length === 0 ? <p className="empty">Completed hands appear here.</p> :
              <ol className="hand-history">
                {history.entries.slice(0, 5).map(({ id, result, net }) => (
                  <li key={id}><span>{resultTitles[result]}</span><strong data-outcome={result}>
                    {net > 0 ? "+" : net < 0 ? "−" : ""}{formatCredits(Math.abs(net))}
                  </strong></li>
                ))}
              </ol>}
          </section>

          <details className="control-panel rules">
            <summary>Rules &amp; hand rankings</summary>
            <p>Deal three cards each. You can stay blind or look at your cards. Chaal adds one more ante, matched by the dealer. Show compares both hands. The stronger hand takes the pot, ties return your stake, and folding gives the pot to the dealer. Leaving mid-hand resolves it as a show.</p>
            <p>A-K-Q is the highest sequence, followed by A-2-3 and K-Q-J. Suits have equal rank.</p>
            <ol reversed>
              {[...HAND_RANKS].reverse().map(({ name, description }) => (
                <li key={name}><strong>{name}</strong><span>{description}</span></li>
              ))}
            </ol>
          </details>
        </aside>
      </div>
    </>
  );
}
