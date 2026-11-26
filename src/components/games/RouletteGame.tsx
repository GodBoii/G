"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useWallet } from "@/context/WalletContext";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useRoundLock } from "@/hooks/useRoundLock";
import { useSettlement } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import { COLUMNS, DOZENS, EVEN_MONEY, nextWheelRotation, pocketColor, spinRoulette, targetLabel,
  type BetTarget, type PlacedChip } from "@/lib/logic/roulette";
import { formatCredits, MAX_BET } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";
import { ChipPicker } from "./ChipPicker";
import { RouletteWheel } from "./RouletteWheel";
import { TableHeading } from "./TableHeading";

const numbers = Array.from({ length: 36 }, (_, index) => index + 1);
const SPIN_DURATION = 2450;
type SpinResult = { id: number; number: number; net: number };

export function RouletteGame() {
  const { balanceCents } = useWallet();
  const { tryLock, unlock, busy } = useRoundLock();
  const { stake, settle } = useSettlement();
  const timers = useTimers();
  const reducedMotion = useReducedMotion();
  const history = useHistory<SpinResult>();
  const [chips, setChips] = useState<readonly PlacedChip[]>([]);
  const [denomination, setDenomination] = useState(10);
  const [wheel, setWheel] = useState({ rotation: 0, ballRotation: 0 });
  const [error, setError] = useState("");
  const wheelStage = useRef<HTMLDivElement>(null);
  const latest = history.entries[0];

  const grouped = new Map<BetTarget, number>();
  let total = 0;
  for (const { target, cents } of chips) {
    grouped.set(target, (grouped.get(target) ?? 0) + cents);
    total += cents;
  }
  const chipCents = denomination * 100;
  const canSpin = total > 0 && balanceCents !== null && total <= balanceCents;

  function addChip(target: BetTarget) {
    if (busy || balanceCents === null) return;
    if (total + chipCents > balanceCents) {
      setError("Choose a smaller chip or add to your balance.");
      return;
    }
    if (total + chipCents > MAX_BET) {
      setError("The table limit is 1,000,000 chips.");
      return;
    }
    setChips((selected) => [...selected, { target, cents: chipCents }]);
    setError("");
  }

  function spin() {
    if (!canSpin || !tryLock()) return;
    setError("");
    try {
      const result = spinRoulette(chips);
      const ticket = stake(total, result.payout);
      if (!ticket) {
        setError("Your balance changed. Remove chips or refill to spin.");
        unlock();
        return;
      }

      setWheel((previous) => ({
        rotation: nextWheelRotation(previous.rotation, result.index),
        ballRotation: previous.ballRotation - 4 * 360,
      }));
      if (window.matchMedia("(max-width: 760px)").matches) {
        wheelStage.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" });
      }
      const placedTicket = ticket;
      function finish() {
        settle(placedTicket);
        history.add({ id: placedTicket.id, number: result.number, net: result.payout - total });
        unlock();
      }
      if (reducedMotion) finish();
      else timers.setTimeout(finish, SPIN_DURATION);
    } catch (failure) {
      setError(playErrorMessage(failure));
      unlock();
    }
  }

  function betButton(target: BetTarget) {
    const number = typeof target === "number";
    const color = number ? pocketColor(target) : target === "red" || target === "black" ? target : undefined;
    const amount = grouped.get(target) ?? 0;
    const style: (CSSProperties & Record<`--${string}`, number>) | undefined = number && target > 0 ? {
      "--board-row": 3 - ((target - 1) % 3),
      "--board-column": Math.ceil(target / 3),
    } : undefined;
    const name = number ? `${target} ${color}` : targetLabel(target);
    const hit = !busy && number && latest?.number === target;

    return (
      <button key={target} type="button" className="bet-cell" data-color={color} data-staked={amount > 0}
        data-hit={hit || undefined} disabled={busy || balanceCents === null} style={style}
        aria-label={`Bet on ${name}${amount ? `, ${formatCredits(amount)} chips placed` : ""}`}
        onClick={() => addChip(target)}>
        <span>{targetLabel(target)}</span>
        {amount > 0 && <span aria-hidden="true" className="placed-chip">{amount / 100}</span>}
      </button>
    );
  }

  const net = latest?.net;
  return (
    <>
      <TableHeading title="European roulette" description="The classic single-zero wheel." icon="◉" theme="roulette" />
      <div className="game-grid roulette-grid">
        <section className="game-surface roulette-surface" aria-label="Roulette table">
          <div className="surface-caption"><span>HOUSE 37 &nbsp;/&nbsp; ROULETTE</span><span>SINGLE ZERO</span></div>
          <div className="wheel-stage" ref={wheelStage}>
            <RouletteWheel {...wheel} spinning={busy} hasResult={Boolean(latest)} />
            <div className="wheel-result" role="status" data-outcome={!busy && net !== undefined && net > 0 ? "win" : undefined}>
              {busy ? <strong>Wheel spinning…</strong> : latest ? (
                <>
                  <span className="result-pocket" data-color={pocketColor(latest.number)}>{latest.number}</span>
                  <strong>{pocketColor(latest.number)} {latest.number}</strong>
                  <span>{latest.net > 0 ? "+" : latest.net < 0 ? "−" : ""}{formatCredits(Math.abs(latest.net))} chips net</span>
                </>
              ) : <strong>Place your chips</strong>}
            </div>
          </div>
          <div className="board">
            <div className="board-heading">
              <div><h2>Betting board</h2><p>Tap a spot to place your selected chip.</p></div>
              <ChipPicker label="Chip value" value={denomination} onChange={(value) => { setDenomination(value); setError(""); }}
                disabled={busy} />
            </div>
            <div className="inside-bets" aria-label="Number bets" role="group">
              <div className="zero-bet">{betButton(0)}</div>
              <div className="number-grid">{numbers.map(betButton)}</div>
            </div>
            <div className="outside-bets three" aria-label="Dozen bets" role="group">{DOZENS.map(({ id }) => betButton(id))}</div>
            <div className="outside-bets three" aria-label="Column bets" role="group">{COLUMNS.map(({ id }) => betButton(id))}</div>
            <div className="outside-bets six" aria-label="Even-money bets" role="group">{EVEN_MONEY.map(({ id }) => betButton(id))}</div>
            <p className="board-error" role="status">{error}</p>
          </div>
        </section>

        <aside className="game-controls" aria-label="Roulette controls">
          <section className="control-panel">
            <h2>Your bets</h2>
            <div className="roulette-action">
              <div className="amount-line"><span>Total stake</span><strong>{formatCredits(total)} chips</strong></div>
              <button className="primary game-primary" type="button" onClick={spin} disabled={busy || !canSpin}>
                {busy ? "Spinning…" : "Spin wheel"} <span aria-hidden="true">⟳</span>
              </button>
            </div>
            <div className="bet-tools">
              <button type="button" className="secondary" disabled={busy || chips.length === 0}
                onClick={() => { setChips((selected) => selected.slice(0, -1)); setError(""); }}>Undo chip</button>
              <button type="button" className="secondary" disabled={busy || chips.length === 0}
                onClick={() => { setChips([]); setError(""); }}>Clear bets</button>
            </div>
            {grouped.size > 0 ? (
              <ul className="bet-slip">
                {[...grouped].map(([target, cents]) => <li key={target}>
                  <span>{targetLabel(target)}</span><strong>{formatCredits(cents)}</strong>
                </li>)}
              </ul>
            ) : <p className="control-hint">Add a chip to the board to start.</p>}
            {balanceCents !== null && total > balanceCents && (
              <p className="control-hint" role="status">Remove chips or refill your balance.</p>
            )}
          </section>
          <section className="control-panel compact">
            <h2>Recent spins</h2>
            {history.entries.length === 0 ? <p className="empty">Winning numbers appear here.</p> :
              <ol className="spin-history">
                {history.entries.slice(0, 10).map(({ id, number }) => (
                  <li className="result-pocket" key={id} data-color={pocketColor(number)}
                    aria-label={`${pocketColor(number)} ${number}`}>{number}</li>
                ))}
              </ol>}
          </section>
          <details className="control-panel rules">
            <summary>Rules &amp; payouts</summary>
            <p>The wheel has 37 pockets, numbered 0–36. Each spin settles every chip on the board. Zero pays straight-up zero bets only. Your layout stays on the board so you can edit it before the next spin.</p>
            <ol>
              <li><strong>35 to 1</strong><span>One number</span></li>
              <li><strong>2 to 1</strong><span>Dozen or column</span></li>
              <li><strong>1 to 1</strong><span>Color, parity or high/low</span></li>
            </ol>
          </details>
        </aside>
      </div>
    </>
  );
}
