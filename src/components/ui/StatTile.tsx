import type { ReactNode } from "react";

export type StatTone = "default" | "win" | "loss" | "gold";

const TONES: Record<StatTone, string> = {
  default: "text-ink",
  win: "text-emerald-300",
  loss: "text-rose-300",
  gold: "text-amber-300",
};

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** data-testid placed on the value element (exact-text assertions). */
  testId?: string;
  tone?: StatTone;
  className?: string;
}

/** Small label/value tile. */
export function StatTile({ label, value, testId, tone = "default", className = "" }: StatTileProps) {
  return (
    <div className={`min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p data-testid={testId} className={`mt-0.5 truncate font-display text-lg font-semibold tabular-nums ${TONES[tone]}`}>
        {value}
      </p>
    </div>
  );
}
