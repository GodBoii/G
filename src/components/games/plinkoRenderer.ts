// Canvas drawing for Plinko. Pure drawing helpers: no React, no RNG, safe with a null context.
import type { PlinkoLayout } from "@/lib/logic/plinko";

export interface RenderedBall {
  x: number;
  y: number;
}

/** A peg flashes for the first half of the hop after a ball strikes it. */
export interface StruckPeg {
  row: number;
  index: number;
}

/**
 * Sizes the backing store for devicePixelRatio and returns the context (null when 2D is unavailable).
 * The CSS size comes from the element itself (w-full + aspect ratio).
 */
export function sizeCanvas(canvas: HTMLCanvasElement, layout: PlinkoLayout, dpr: number): CanvasRenderingContext2D | null {
  canvas.width = Math.max(1, Math.round(layout.width * dpr));
  canvas.height = Math.max(1, Math.round(layout.height * dpr));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** The last peg the ball touched, while it is still within the first half of the following hop. */
export function struckPeg(path: readonly (0 | 1)[], t: number): StruckPeg | null {
  const rows = path.length;
  const pos = Math.min(1, Math.max(0, t)) * (rows + 1);
  const seg = Math.floor(pos);
  if (seg < 1 || seg > rows || pos - seg > 0.5) return null;
  const row = seg - 1;
  let right = 0;
  for (let i = 0; i < row; i++) right += path[i];
  // Row r has r + 3 pegs; the ball sits on peg index R_r + 1 of that row.
  return { row, index: right + 1 };
}

export function drawPlinko(
  ctx: CanvasRenderingContext2D | null,
  layout: PlinkoLayout,
  balls: readonly RenderedBall[],
  struck: readonly StruckPeg[],
): void {
  if (!ctx) return;
  const { width, height, pegR, ballR, rows } = layout;
  ctx.clearRect(0, 0, width, height);

  const lit = new Set(struck.map((p) => `${p.row}:${p.index}`));
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < r + 3; j++) {
      const peg = layout.pegs[k++];
      const on = lit.has(`${r}:${j}`);
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, on ? pegR * 1.35 : pegR, 0, Math.PI * 2);
      if (on) {
        ctx.shadowColor = "rgba(251,191,36,0.9)";
        ctx.shadowBlur = pegR * 6;
        ctx.fillStyle = "#fde68a";
      } else {
        ctx.shadowColor = "rgba(255,255,255,0.35)";
        ctx.shadowBlur = pegR * 2;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
      }
      ctx.fill();
    }
  }

  for (const b of balls) {
    const g = ctx.createRadialGradient(b.x - ballR * 0.35, b.y - ballR * 0.35, ballR * 0.1, b.x, b.y, ballR);
    g.addColorStop(0, "#fef3c7");
    g.addColorStop(0.45, "#fbbf24");
    g.addColorStop(1, "#d97706");
    ctx.beginPath();
    ctx.arc(b.x, b.y, ballR, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(251,191,36,0.85)";
    ctx.shadowBlur = ballR * 2.5;
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}
