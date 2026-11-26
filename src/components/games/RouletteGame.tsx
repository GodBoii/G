"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useTimers } from "@/hooks/useTimers";
import { COLUMNS, DOZENS, OUTSIDE_PICKS, matchesPocket, nextBallRotation, pickLabel, pocketColor, spinRoulette,
  type Pick } from "@/lib/logic/roulette";
import { playErrorMessage } from "@/lib/rng";
import { RouletteWheel, SPIN_DURATION } from "./RouletteWheel";
import { TableHeading } from "./TableHeading";

const numbers = Array.from({ length: 36 }, (_, index) => index + 1);
type SpinResult = { id: number; number: number; matched: readonly Pick[]; pickCount: number };

export function RouletteGame() {
  const { tryLock, unlock, busy } = useRoundLock();
  const timers = useTimers();
  const reducedMotion = useReducedMotion();
  const history = useHistory<SpinResult>();
  const [picks, setPicks] = useState<readonly Pick[]>([]);
  const [wheel, setWheel] = useState({ rotation: 0, ballRotation: 0 });
  const [error, setError] = useState("");
  const wheelStage = useRef<HTMLDivElement>(null);
  const latest = history.entries[0];

  function togglePick(pick: Pick) {
    setPicks((selected) => selected.includes(pick) ? selected.filter((item) => item !== pick) : [...selected, pick]);
    setError("");
  }

  function spin() {
    if (!tryLock()) return;
    setError("");
    try {
      const result = spinRoulette();
      const id = (latest?.id ?? 0) + 1;
      setWheel((previous) => ({
        rotation: previous.rotation + 545,
        ballRotation: nextBallRotation(previous.ballRotation, result.index),
      }));

      if (window.matchMedia("(max-width: 760px), (max-width: 950px) and (max-height: 500px)").matches) {
        wheelStage.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" });
      }

      function finish() {
        history.add({ id, number: result.number, matched: picks.filter((pick) => matchesPocket(pick, result.number)),
          pickCount: picks.length });
        unlock();
      }
      if (reducedMotion) finish();
      else timers.setTimeout(finish, SPIN_DURATION);
    } catch (failure) {
      setError(playErrorMessage(failure));
      unlock();
    }
  }

  function pickButton(pick: Pick) {
    const number = typeof pick === "number";
    const color = number ? pocketColor(pick) : pick === "red" || pick === "black" ? pick : undefined;
    const style: (CSSProperties & Record<`--${string}`, number>) | undefined = number && pick > 0 ? {
      "--board-row": 3 - ((pick - 1) % 3),
      "--board-column": Math.ceil(pick / 3),
    } : undefined;
    const label = number ? `${pick} ${color}` : pickLabel(pick);
    return (
      <button className="pick-cell" key={pick} type="button" data-color={color} style={style}
        aria-label={`Pick ${label}`} aria-pressed={picks.includes(pick)} disabled={busy}
        data-hit={!busy && (latest?.number === pick || latest?.matched.includes(pick)) || undefined}
        onClick={() => togglePick(pick)}>
        {pickLabel(pick)}
      </button>
    );
  }

  const matchLabel = latest && latest.pickCount > 0 ?
    `${latest.matched.length} of ${latest.pickCount} ${latest.pickCount === 1 ? "pick" : "picks"} matched` : null;

  return (
    <div className="game-room" data-theme="roulette">
      <TableHeading title="European roulette" description="Call the pocket. Watch where the ball lands." />
      <div className="table-room roulette-room">
        <div className="roulette-stage" ref={wheelStage}>
          <div className="roulette-light" aria-hidden="true" />
          <RouletteWheel {...wheel} spinning={busy} showBall={Boolean(latest)} />
          <div className="spin-status" role="status">
            {busy ? <strong>Wheel spinning…</strong> : latest ? (
              <div className="landed-result" key={latest.id}>
                <span className="result-pocket" aria-hidden="true" data-color={pocketColor(latest.number)}>{latest.number}</span>
                <div><strong>{pocketColor(latest.number)} {latest.number}</strong>{matchLabel && <span>{matchLabel}</span>}</div>
              </div>
            ) : <strong>Ready to spin</strong>}
          </div>
        </div>
        <section className="roulette-console" aria-labelledby="pick-heading">
          <div className="console-heading">
            <h2 id="pick-heading">Make a prediction</h2>
            <p>Select a number or group, or spin to explore the wheel.</p>
          </div>
          <div className="inside-picks" role="group" aria-label="Numbers">
            <div className="zero-pick">{pickButton(0)}</div>
            <div className="number-grid">{numbers.map(pickButton)}</div>
          </div>
          <div className="outside-picks three" role="group" aria-label="Dozens">{DOZENS.map(({ id }) => pickButton(id))}</div>
          <div className="outside-picks three" role="group" aria-label="Columns">{COLUMNS.map(({ id }) => pickButton(id))}</div>
          <div className="outside-picks six" role="group" aria-label="Color, parity and range">{OUTSIDE_PICKS.map(({ id }) => pickButton(id))}</div>
          <div className="roulette-actions">
            <div className="pick-summary">
              <span>{picks.length === 0 ? "No picks" : `${picks.length} ${picks.length === 1 ? "pick" : "picks"}`}</span>
              <button type="button" className="text-button" disabled={busy || picks.length === 0} onClick={() => setPicks([])}>Clear</button>
            </div>
            <button type="button" className="primary" disabled={busy} onClick={spin}>
              {busy ? "Spinning…" : "Spin wheel"} <span aria-hidden="true">↻</span>
            </button>
          </div>
          {error && <p className="round-error" role="alert">{error}</p>}
        </section>
      </div>
      <div className="table-notes">
        <section aria-labelledby="spins-heading">
          <h2 id="spins-heading">Recent spins</h2>
          {history.entries.length > 0 ? (
            <ol className="spin-history">
              {history.entries.slice(0, 10).map(({ id, number }) => (
                <li key={id} className="result-pocket" data-color={pocketColor(number)}
                  aria-label={`${pocketColor(number)} ${number}`}>{number}</li>
              ))}
            </ol>
          ) : <p>Numbers appear here after each spin.</p>}
        </section>
        <details className="table-rules">
          <summary>How to play</summary>
          <p>Each spin lands in one of 37 pockets. A number, color, dozen, column, parity or range pick can match. Zero matches only a direct pick on zero. Your picks stay selected until you change or clear them.</p>
        </details>
      </div>
    </div>
  );
}
