import Link from "next/link";
import type { ReactNode } from "react";
import { getGame, type GameMeta } from "@/lib/games";

export interface GamePageShellProps {
  slug: GameMeta["slug"];
  /** Static rules / odds / paytables (rendered inside the .rules container). */
  rules: ReactNode;
  /** The client game component. */
  children: ReactNode;
}

/** Server shell for every game page: back link, category chip, the page's only h1, description, rules. */
export function GamePageShell({ slug, rules, children }: GamePageShellProps) {
  const game = getGame(slug);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> All games
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-3xl shadow-lg sm:size-16 sm:text-4xl ${game.accent.from} ${game.accent.to}`}
        >
          {game.icon}
        </span>
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {game.category}
          </span>
          <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            {game.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted sm:text-base">{game.description}</p>
        </div>
      </header>

      <div className="mt-6 sm:mt-8">{children}</div>

      <details className="glass group mt-8 p-4 sm:p-6">
        <summary className="flex items-center justify-between gap-4 rounded-lg font-display text-lg font-semibold text-ink">
          How to play & payouts
          <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="rules mt-4 text-sm leading-relaxed text-ink-muted">{rules}</div>
      </details>
    </div>
  );
}
