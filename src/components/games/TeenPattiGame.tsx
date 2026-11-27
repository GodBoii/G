"use client";

import { useState } from "react";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useTableAudio } from "@/hooks/useTableAudio";
import { useTimers } from "@/hooks/useTimers";
import { compareHands, dealHands, HAND_RANKS, handName } from "@/lib/logic/teenPatti";
import { playErrorMessage } from "@/lib/rng";
import { PlayingCard } from "./PlayingCard";
import { TableHeading } from "./TableHeading";

type Hands = ReturnType<typeof dealHands>;
type Round = Hands & { id: number; seen: boolean };
type Result = "win" | "loss" | "tie" | "fold";
type Stage =
  | { kind: "ready" }
  | { kind: "dealing" | "playing" | "revealing"; round: Round }
  | { kind: "finished"; round: Round; result: Result };

const positions = ["left", "middle", "right"];
const resultTitles: Record<Result, string> = { win: "You win", loss: "Dealer wins", tie: "Tie", fold: "You folded" };

function HandDisplay({ label, hand, reveal, dealing }: {
  label: string;
  hand: Hands["player"] | undefined;
  reveal: boolean;
  dealing: boolean;
}) {
  return (
    <div className="hand" data-dealing={dealing}>
      <div className="hand-label">
        <strong>{label}</strong>
        <span>{reveal && hand ? handName(hand) : hand ? "Face down" : "Waiting for cards"}</span>
      </div>
      <div className="hand-cards">
        {positions.map((position, index) => (
          <div className="hand-slot" key={position}>
            {hand ? <PlayingCard card={reveal ? hand[index] : undefined} /> : <span className="empty-card" aria-hidden="true">✦</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeenPattiGame() {
  const { tryLock, unlock, busy } = useRoundLock();
  const timers = useTimers();
  const sound = useTableAudio();
  const reducedMotion = useReducedMotion();
  const history = useHistory<{ id: number; result: Result; hand: string }>();
  const [stage, setStage] = useState<Stage>({ kind: "ready" });
  const [error, setError] = useState("");

  const round = stage.kind === "ready" ? undefined : stage.round;
  const showdown = stage.kind === "revealing" || (stage.kind === "finished" && stage.result !== "fold");
  const playing = stage.kind === "playing";
  const result = stage.kind === "finished" ? stage.result : undefined;
  const message = result ? resultTitles[result] :
    stage.kind === "dealing" ? "Dealing cards…" :
    stage.kind === "revealing" ? "Showdown…" :
    playing ? "Peek or go straight to the show." : "Ready to deal";

  function deal() {
    if ((stage.kind !== "ready" && stage.kind !== "finished") || !tryLock()) return;
    setError("");
    try {
      const next = { ...dealHands(), id: (round?.id ?? 0) + 1, seen: false };
      sound.play(reducedMotion ? "quickDeal" : "deal");
      function finishDeal() {
        setStage({ kind: "playing", round: next });
        unlock();
      }
      if (reducedMotion) finishDeal();
      else {
        setStage({ kind: "dealing", round: next });
        timers.setTimeout(finishDeal, 670);
      }
    } catch (failure) {
      setError(playErrorMessage(failure));
      unlock();
    }
  }

  function finish(fold: boolean) {
    if (stage.kind !== "playing" || !tryLock()) return;
    const { round } = stage;
    const comparison = compareHands(round.player, round.dealer);
    const outcome = fold ? "fold" : comparison > 0 ? "win" : comparison < 0 ? "loss" : "tie";

    if (!fold) sound.play("reveal");

    function complete() {
      setStage({ kind: "finished", round, result: outcome });
      history.add({ id: round.id, result: outcome, hand: fold && !round.seen ? "Blind fold" : handName(round.player) });
      unlock();
      sound.play(outcome, reducedMotion && !fold ? 0.16 : 0);
    }
    if (fold || reducedMotion) complete();
    else {
      setStage({ kind: "revealing", round });
      timers.setTimeout(complete, 680);
    }
  }

  const primaryLabel = stage.kind === "dealing" ? "Dealing…" :
    stage.kind === "revealing" ? "Revealing…" : playing ? "Show hands" :
    stage.kind === "finished" ? "Deal again" : "Deal cards";

  return (
    <div className="game-room" data-theme="patti">
      <TableHeading title="Teen Patti" description="Three cards each. The strongest hand wins."
        soundEnabled={sound.enabled} onToggleSound={sound.toggle} />
      <div className="table-room patti-room">
        <div className="patti-stage">
          <div className="patti-felt" aria-hidden="true"><span>♠</span></div>
          <div className="patti-hands">
            <HandDisplay key={`dealer-${round?.id ?? 0}`} label="Dealer" hand={round?.dealer} reveal={showdown} dealing={stage.kind === "dealing"} />
            <div className="deck-stack" aria-hidden="true"><PlayingCard /></div>
            <HandDisplay key={`player-${round?.id ?? 0}`} label="Your hand" hand={round?.player} reveal={showdown || Boolean(round?.seen)}
              dealing={stage.kind === "dealing"} />
          </div>
          <div className="hand-status" role="status" data-result={result}>
            <span key={`${round?.id ?? 0}-${stage.kind}`}>{message}</span>
          </div>
        </div>
        <div className="patti-actions">
          <button className="primary" type="button" disabled={busy} onClick={playing ? () => finish(false) : deal}>
            {primaryLabel} <span aria-hidden="true">♠</span>
          </button>
          <button className="secondary" type="button" disabled={!playing || round?.seen}
            onClick={() => {
              if (stage.kind !== "playing" || stage.round.seen) return;
              setStage({ kind: "playing", round: { ...stage.round, seen: true } });
              sound.play("reveal");
            }}>See cards</button>
          <button className="secondary" type="button" disabled={!playing} onClick={() => finish(true)}>Fold</button>
        </div>
        {error && <p className="round-error" role="alert">{error}</p>}
      </div>
      <div className="table-notes">
        <section aria-labelledby="hands-heading">
          <h2 id="hands-heading">Recent hands</h2>
          {history.entries.length > 0 ? (
            <ol className="hand-history">
              {history.entries.slice(0, 4).map(({ id, result, hand }) => (
                <li key={id}><strong data-result={result}>{resultTitles[result]}</strong><span>{hand}</span></li>
              ))}
            </ol>
          ) : <p>Completed hands appear here.</p>}
        </section>
        <details className="table-rules">
          <summary>How to play &amp; hand rankings</summary>
          <p>See your cards or go straight to the showdown. The strongest hand wins. A-K-Q is the highest sequence, followed by A-2-3 and K-Q-J. Suits have equal rank.</p>
          <ol reversed className="ranking-list">
            {[...HAND_RANKS].reverse().map(({ name, description }) => (
              <li key={name}><strong>{name}</strong><span>{description}</span></li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
}
