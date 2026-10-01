"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BetControls } from "@/components/ui/BetControls";
import { GameLayout } from "@/components/ui/GameLayout";
import { History } from "@/components/ui/History";
import { ResultBanner, bannerFor, idleBanner, type BannerState } from "@/components/ui/ResultBanner";
import { Segmented, type SegmentedOption } from "@/components/ui/Segmented";
import { useBetInput } from "@/hooks/useBetInput";
import { useHistory } from "@/hooks/useHistory";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSettlement, type Ticket } from "@/hooks/useSettlement";
import { useTimers } from "@/hooks/useTimers";
import {
  PLINKO_DEFAULT_RISK,
  PLINKO_DEFAULT_ROWS,
  PLINKO_ROWS,
  PLINKO_X10,
  ballPosition,
  bucketLabel,
  bucketTone,
  dropBall,
  plinkoLayout,
  plinkoMultiplierX10,
  type PlinkoLayout,
  type PlinkoRisk,
  type PlinkoRows,
} from "@/lib/logic/plinko";
import { formatMultiplier, payoutFromMultiplier } from "@/lib/money";
import { playErrorMessage } from "@/lib/rng";
import { drawPlinko, sizeCanvas, struckPeg, type RenderedBall, type StruckPeg } from "./plinkoRenderer";

const SEG_MS = 110;
const REDUCED_SEG_MS = 40;
const MAX_IN_FLIGHT = 20;

const RISK_LABEL: Record<PlinkoRisk, string> = { low: "Low", medium: "Medium", high: "High" };
const RISK_OPTIONS: readonly SegmentedOption<PlinkoRisk>[] = [
  { value: "low", label: "Low", testId: "plinko-risk-low" },
  { value: "medium", label: "Medium", testId: "plinko-risk-medium" },
  { value: "high", label: "High", testId: "plinko-risk-high" },
];

interface Ball {
  path: (0 | 1)[];
  bucket: number;
  /** Set on the first animation frame. */
  startTime: number | null;
  segMs: number;
  ticket: Ticket;
  rows: PlinkoRows;
  risk: PlinkoRisk;
  x10: number;
}

interface HitCounts {
  /** `${rows}/${risk}`; counts are treated as zeros when this differs from the current settings. */
  key: string;
  counts: number[];
  /** Per-bucket landing nonce, used to replay the bucket-pop animation. */
  nonces: number[];
}

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

export function PlinkoGame() {
  const bet = useBetInput();
  const timers = useTimers();
  const { stake, settle } = useSettlement();
  const history = useHistory();
  const reducedMotion = useReducedMotion();
  const rowsId = useId();

  const [rows, setRows] = useState<PlinkoRows>(PLINKO_DEFAULT_ROWS);
  const [risk, setRisk] = useState<PlinkoRisk>(PLINKO_DEFAULT_RISK);
  const [inFlight, setInFlight] = useState(0);
  const [hits, setHits] = useState<HitCounts>({ key: "", counts: [], nonces: [] });
  const [lastBucket, setLastBucket] = useState<{ key: string; index: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(() => idleBanner("Pick rows and risk, then drop a ball"));

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<PlinkoLayout | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const loopRef = useRef(false);

  // Canvas sizing: ResizeObserver + devicePixelRatio. Pure DOM work (no setState).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    function resize(width: number) {
      if (!canvas || width <= 0) return;
      const layout = plinkoLayout(rows, width);
      layoutRef.current = layout;
      ctxRef.current = sizeCanvas(canvas, layout, window.devicePixelRatio || 1);
      // While balls fly the rAF loop redraws every frame; otherwise draw the idle board now.
      if (!loopRef.current) drawPlinko(ctxRef.current, layout, [], []);
    }
    resize(wrap.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) resize(entry.contentRect.width);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [rows]);

  function land(ball: Ball) {
    settle(ball.ticket);
    const key = `${ball.rows}/${ball.risk}`;
    const n = ball.rows + 1;
    setHits((h) => {
      const base = h.key === key ? h : { key, counts: zeros(n), nonces: zeros(n) };
      const counts = base.counts.slice();
      const nonces = base.nonces.slice();
      counts[ball.bucket] += 1;
      nonces[ball.bucket] += 1;
      return { key, counts, nonces };
    });
    setLastBucket({ key, index: ball.bucket });
    const multText = formatMultiplier(ball.x10, 10);
    setBanner((b) =>
      bannerFor({
        betCents: ball.ticket.betCents,
        payoutCents: ball.ticket.payoutCents,
        multiplierText: multText,
        round: b.round + 1,
        detail: `Bucket ${ball.bucket + 1} · ${ball.rows} rows · ${RISK_LABEL[ball.risk]}`,
      }),
    );
    history.add({
      id: ball.ticket.id,
      label: `🔻 #${ball.bucket + 1}`,
      multiplierText: multText,
      betCents: ball.ticket.betCents,
      payoutCents: ball.ticket.payoutCents,
    });
  }

  function ensureLoop() {
    if (loopRef.current) return;
    loopRef.current = true;
    const step = (now: number) => {
      const layout = layoutRef.current;
      const positions: RenderedBall[] = [];
      const struck: StruckPeg[] = [];
      const landed: Ball[] = [];
      for (const ball of ballsRef.current) {
        if (ball.startTime === null) ball.startTime = now;
        const t = (now - ball.startTime) / (ball.segMs * (ball.path.length + 1));
        if (t >= 1) {
          landed.push(ball);
          continue;
        }
        if (layout) {
          positions.push(ballPosition(ball.path, t, layout));
          const peg = struckPeg(ball.path, t);
          if (peg) struck.push(peg);
        }
      }
      if (landed.length > 0) {
        ballsRef.current = ballsRef.current.filter((b) => !landed.includes(b));
        for (const ball of landed) land(ball);
        setInFlight(ballsRef.current.length);
      }
      // Null-context safe: balls still resolve on the same timing when nothing can be drawn.
      if (layout) drawPlinko(ctxRef.current, layout, positions, struck);
      if (ballsRef.current.length > 0) {
        timers.requestFrame(step);
      } else {
        loopRef.current = false;
      }
    };
    timers.requestFrame(step);
  }

  function onDrop() {
    if (!bet.valid || ballsRef.current.length >= MAX_IN_FLIGHT) return;
    const r = rows;
    const k = risk;
    let ticket: Ticket | null;
    let drop: ReturnType<typeof dropBall>;
    let x10: number;
    try {
      drop = dropBall(r);
      x10 = plinkoMultiplierX10(r, k, drop.bucket);
      ticket = stake(bet.parsed, payoutFromMultiplier(bet.parsed, x10, 10));
    } catch (e) {
      setBanner((b) => ({ kind: "error", title: playErrorMessage(e), round: b.round }));
      console.error(e);
      return;
    }
    if (!ticket) {
      setNotice("Not enough credits");
      return;
    }
    setNotice(null);
    if (ballsRef.current.length === 0) setBanner((b) => ({ kind: "pending", title: "Dropping…", round: b.round }));
    ballsRef.current = [
      ...ballsRef.current,
      {
        path: drop.path,
        bucket: drop.bucket,
        startTime: null,
        segMs: reducedMotion ? REDUCED_SEG_MS : SEG_MS,
        ticket,
        rows: r,
        risk: k,
        x10,
      },
    ];
    setInFlight(ballsRef.current.length);
    ensureLoop();
  }

  const key = `${rows}/${risk}`;
  const table = PLINKO_X10[rows][risk];
  const counts = hits.key === key ? hits.counts : zeros(rows + 1);
  const nonces = hits.key === key ? hits.nonces : zeros(rows + 1);
  const lastIndex = lastBucket && lastBucket.key === key ? lastBucket.index : null;
  const settingsLocked = inFlight > 0;

  const board = (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col">
      <div ref={wrapRef} className="w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Plinko board, ${rows} rows, ${RISK_LABEL[risk].toLowerCase()} risk`}
          className="block aspect-[10/9] w-full"
        />
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${rows + 1}, minmax(0, 1fr))`, paddingInline: `${50 / (rows + 2)}%` }}
      >
        {table.map((x10, i) => {
          const tone = bucketTone(x10);
          const nonce = nonces[i];
          return (
            <div key={i} className="px-px">
              <div
                key={`${i}-${nonce}`}
                data-testid="plinko-bucket"
                data-index={i}
                data-hit-count={counts[i]}
                className={`grid h-7 place-items-center rounded-md font-semibold tabular-nums leading-none sm:h-8 ${tone.fill} ${tone.text} ${
                  nonce > 0 ? "animate-bucket-pop" : ""
                } ${lastIndex === i ? "ring-2 ring-white/80 shadow-glow-amber" : ""}`}
                style={{ fontSize: "clamp(8px, 2.2vw, 12px)" }}
              >
                {bucketLabel(x10)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Bucket multipliers ·{" "}
        <span className="tabular-nums">
          {inFlight}/{MAX_IN_FLIGHT}
        </span>{" "}
        balls in flight
      </p>
    </div>
  );

  const controls = (
    <BetControls
      bet={bet}
      inputDisabled={false}
      primaryDisabled={!bet.valid || inFlight >= MAX_IN_FLIGHT}
      primaryLabel="Drop ball"
      onPrimary={onDrop}
    >
      <div>
        <label htmlFor={rowsId} className="text-sm font-medium text-ink-muted">
          Rows
        </label>
        <select
          id={rowsId}
          value={rows}
          disabled={settingsLocked}
          onChange={(e) => setRows(Number(e.target.value) as PlinkoRows)}
          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-bg-950/70 px-3 font-semibold tabular-nums text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {PLINKO_ROWS.map((r) => (
            <option key={r} value={r}>
              {r} rows
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-muted">Risk</p>
        <Segmented<PlinkoRisk> label="Risk" options={RISK_OPTIONS} value={risk} onChange={setRisk} disabled={settingsLocked} />
      </div>
      {settingsLocked && <p className="text-xs text-ink-faint">Rows and risk unlock when every ball has landed.</p>}
      {notice && (
        <p role="alert" className="text-sm text-rose-300">
          {notice}
        </p>
      )}
    </BetControls>
  );

  return (
    <GameLayout
      boardLabel="Plinko board"
      board={board}
      controls={controls}
      result={<ResultBanner state={banner} />}
      history={<History entries={history.entries} />}
    />
  );
}
