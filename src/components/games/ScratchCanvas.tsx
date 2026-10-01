"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { coverageFraction } from "@/lib/logic/scratch";

/** Fraction of cleared lattice samples that auto-reveals the card. */
const REVEAL_COVERAGE = 0.55;
/** Coverage is read back every N pointermoves (and on every pointerup/pointercancel). */
const CHECK_EVERY_MOVES = 8;
/** Stroke radius as a fraction of the card width. */
const BRUSH_RADIUS = 0.07;

export interface ScratchCanvasProps {
  /** Called when the scratched area reaches 55%. The parent guards exactly-once settlement. */
  onReveal(): void;
  /** True once the card is revealed or a "Reveal all" fade is running: the foil fades out and ignores input. */
  cleared: boolean;
  /** Fade duration in ms (0 under reduced motion). */
  fadeMs: number;
}

/** Deterministic sparkle positions (no RNG: the foil is purely decorative). */
const SPARKLES = Array.from({ length: 46 }, (_, i) => ({
  x: (Math.sin(i * 12.9898) * 43758.5453) % 1,
  y: (Math.sin(i * 78.233) * 12345.6789) % 1,
  r: 0.004 + ((i * 7) % 5) * 0.0018,
}));

function drawFoil(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#9ca3af");
  g.addColorStop(0.3, "#e5e7eb");
  g.addColorStop(0.5, "#a1a1aa");
  g.addColorStop(0.72, "#f4f4f5");
  g.addColorStop(1, "#9ca3af");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Diagonal brushed-metal sheen.
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (let x = -h; x < w; x += w * 0.035) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const s of SPARKLES) {
    ctx.beginPath();
    ctx.arc(Math.abs(s.x) * w, Math.abs(s.y) * h, s.r * w, 0, Math.PI * 2);
    ctx.fill();
  }

  const fontPx = Math.round(w * 0.085);
  ctx.font = `800 ${fontPx}px Outfit, Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(39,39,42,0.78)";
  ctx.fillText("SCRATCH HERE", w / 2, h / 2);
  ctx.font = `600 ${Math.round(fontPx * 0.42)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(39,39,42,0.6)";
  ctx.fillText("Match 3 symbols to win", w / 2, h / 2 + fontPx * 0.95);
}

/**
 * Scratch-off foil over the symbol grid. A CSS foil <div> is always rendered under the canvas;
 * when a 2D context is available the canvas draws the foil and the CSS foil is hidden, otherwise
 * the canvas is hidden and the CSS foil stays (Reveal all still works). DOM mutation only, no setState.
 */
export function ScratchCanvas({ onReveal, cleared, fadeMs }: ScratchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const movesRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cover = coverRef.current;
    if (!canvas || !cover) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      canvas.hidden = true;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    drawFoil(ctx, canvas.width, canvas.height);
    ctxRef.current = ctx;
    cover.hidden = true;
  }, []);

  /** Pointer position in canvas backing-store pixels (works after CSS resizes too). */
  function toCanvas(e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / Math.max(1, rect.width),
      y: ((e.clientY - rect.top) * canvas.height) / Math.max(1, rect.height),
    };
  }

  function scratchTo(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, p: { x: number; y: number }) {
    const radius = BRUSH_RADIUS * canvas.width; // backing store already includes devicePixelRatio
    const from = lastRef.current ?? p;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    lastRef.current = p;
  }

  function checkCoverage(canvas: HTMLCanvasElement) {
    const ctx = ctxRef.current;
    if (!ctx || firedRef.current) return;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    if (coverageFraction(data, width, height) >= REVEAL_COVERAGE) {
      firedRef.current = true;
      onReveal();
    }
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = ctxRef.current;
    if (!ctx || cleared) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    lastRef.current = null;
    movesRef.current = 0;
    scratchTo(ctx, e.currentTarget, toCanvas(e));
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = ctxRef.current;
    if (!ctx || cleared || lastRef.current === null) return;
    scratchTo(ctx, e.currentTarget, toCanvas(e));
    movesRef.current += 1;
    if (movesRef.current % CHECK_EVERY_MOVES === 0) checkCoverage(e.currentTarget);
  }

  function onPointerEnd(e: PointerEvent<HTMLCanvasElement>) {
    if (lastRef.current === null) return;
    lastRef.current = null;
    if (!cleared) checkCoverage(e.currentTarget);
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden rounded-xl"
      style={{
        opacity: cleared ? 0 : 1,
        transition: `opacity ${fadeMs}ms ease-out`,
        pointerEvents: cleared ? "none" : undefined,
      }}
    >
      {/* CSS foil fallback (hidden by the mount effect when the canvas can draw). */}
      <div
        ref={coverRef}
        className="absolute inset-0 grid place-items-center bg-linear-to-br from-zinc-400 via-zinc-200 to-zinc-400"
      >
        <span className="font-display text-xl font-extrabold tracking-wide text-zinc-700 sm:text-2xl">SCRATCH HERE</span>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="absolute inset-0 size-full cursor-crosshair touch-none select-none"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
