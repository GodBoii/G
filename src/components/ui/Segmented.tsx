"use client";

import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional data-testid on the option button. */
  testId?: string;
}

export interface SegmentedProps<T extends string> {
  /** Accessible group name (aria-label). */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange(value: T): void;
  disabled?: boolean;
  className?: string;
}

/** Toggle-button group: role="group" + aria-label, each option a <button aria-pressed>. */
export function Segmented<T extends string>({ label, options, value, onChange, disabled = false, className = "" }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex gap-1 rounded-xl border border-white/10 bg-bg-950/60 p-1 ${className}`}>
      {options.map((opt) => {
        const pressed = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={pressed}
            data-testid={opt.testId}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              pressed
                ? "bg-linear-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow-fuchsia"
                : "text-ink-muted enabled:hover:bg-white/5 enabled:hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
