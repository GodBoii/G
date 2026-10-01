import { formatCredits } from "@/lib/money";

export interface HistoryEntry {
  /** Unique per round (use ticket.id). */
  id: number;
  label: string;
  multiplierText: string;
  payoutCents: number;
  betCents: number;
}

function amountOf(e: HistoryEntry): { text: string; className: string } {
  if (e.payoutCents > e.betCents) return { text: `+${formatCredits(e.payoutCents)}`, className: "text-emerald-300" };
  if (e.payoutCents === 0) return { text: `−${formatCredits(e.betCents)}`, className: "text-rose-300" };
  return { text: `+${formatCredits(e.payoutCents)}`, className: "text-slate-300" };
}

/** Recent rounds, newest first (useHistory caps the list at 20). */
export function History({ entries, title = "Recent results" }: { entries: readonly HistoryEntry[]; title?: string }) {
  return (
    <div>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-faint">No rounds yet</p>
      ) : (
        <ol aria-label="Recent results" className="mt-2 flex flex-wrap gap-2">
          {entries.map((e) => {
            const amount = amountOf(e);
            return (
              <li
                key={e.id}
                data-testid="history-item"
                data-bet-cents={e.betCents}
                data-payout-cents={e.payoutCents}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tabular-nums"
              >
                <span className="text-ink-muted">{e.label}</span>
                <span className="font-semibold text-ink">{e.multiplierText}</span>
                <span className={`font-semibold ${amount.className}`}>{amount.text}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
