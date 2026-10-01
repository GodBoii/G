import Link from "next/link";
import type { GameMeta } from "@/lib/games";

export function GameCard({ game }: { game: GameMeta }) {
  return (
    <Link
      href={game.href}
      data-testid="game-card"
      className={`group glass relative flex h-full flex-col gap-3 p-5 ring-0 transition duration-200 hover:-translate-y-1 hover:shadow-glow-fuchsia hover:ring-2 focus-visible:-translate-y-1 focus-visible:shadow-glow-fuchsia focus-visible:ring-2 ${game.accent.ring}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={`grid size-14 place-items-center rounded-2xl bg-linear-to-br text-3xl shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 ${game.accent.from} ${game.accent.to}`}
        >
          {game.icon}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
          {game.category}
        </span>
      </div>
      <h3 className="font-display text-xl font-bold text-ink">{game.name}</h3>
      <p className="flex-1 text-sm leading-relaxed text-ink-muted">{game.description}</p>
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-ink-faint">{game.tagline}</span>
        <span className="shrink-0 font-semibold text-amber-300 transition-transform group-hover:translate-x-0.5">
          Play <span aria-hidden="true">→</span>
        </span>
      </p>
    </Link>
  );
}
