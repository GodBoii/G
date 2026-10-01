import { formatCredits } from "@/lib/money";

export type BannerKind = "idle" | "pending" | "win" | "push" | "partial" | "loss" | "error";

export interface BannerState {
  kind: BannerKind;
  title: string;
  detail?: string;
  /** Set for win/push/partial/loss (the settled round). */
  betCents?: number;
  payoutCents?: number;
  /** Machine-readable outcome, set at settle (coin/limbo/dice/wheel). */
  outcome?: string;
  /** Increments each time a round settles; 0 initially. */
  round: number;
}

/** Initial banner before any round. */
export function idleBanner(title = "Place a bet to start"): BannerState {
  return { kind: "idle", title, round: 0 };
}

export interface BannerForArgs {
  betCents: number;
  payoutCents: number;
  /** From formatMultiplier (the only multiplier formatter). */
  multiplierText: string;
  round: number;
  detail?: string;
  outcome?: string;
}

/** Settled banner: kind from the payout/bet comparison, title copy per design §4.7. */
export function bannerFor({ betCents, payoutCents, multiplierText, round, detail, outcome }: BannerForArgs): BannerState {
  let kind: BannerKind;
  let title: string;
  if (payoutCents > betCents) {
    kind = "win";
    title = `You won ${formatCredits(payoutCents)} credits (${multiplierText})`;
  } else if (payoutCents === betCents) {
    kind = "push";
    title = `Money back: ${formatCredits(payoutCents)} credits (${multiplierText})`;
  } else if (payoutCents > 0) {
    kind = "partial";
    title = `Returned ${formatCredits(payoutCents)} credits (${multiplierText})`;
  } else {
    kind = "loss";
    title = "No win this time";
  }
  return { kind, title, detail, betCents, payoutCents, outcome, round };
}

const KIND_STYLES: Record<BannerKind, { box: string; icon: string; title: string }> = {
  idle: { box: "border-white/10 bg-white/5", icon: "🎯", title: "text-ink" },
  pending: { box: "border-violet-400/30 bg-violet-500/10", icon: "⏳", title: "text-ink" },
  win: { box: "border-emerald-400/50 bg-emerald-500/10 animate-win-glow", icon: "🎉", title: "text-emerald-300" },
  push: { box: "border-sky-400/30 bg-sky-500/10", icon: "↩️", title: "text-sky-200" },
  partial: { box: "border-amber-300/30 bg-amber-400/10", icon: "🪙", title: "text-amber-200" },
  loss: { box: "border-rose-400/30 bg-rose-500/10", icon: "💨", title: "text-rose-200" },
  error: { box: "border-rose-400/60 bg-rose-500/15", icon: "⚠️", title: "text-rose-200" },
};

const BIG_WIN_BOX = "border-amber-300/70 bg-amber-400/10 shadow-glow-amber";

export function ResultBanner({ state, className = "" }: { state: BannerState; className?: string }) {
  const { kind, title, detail, betCents, payoutCents, outcome, round } = state;
  const style = KIND_STYLES[kind];
  const bigWin = kind === "win" && betCents !== undefined && payoutCents !== undefined && payoutCents >= betCents * 10;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="result"
      data-kind={kind}
      data-round={round}
      data-bet-cents={betCents}
      data-payout-cents={payoutCents}
      data-outcome={outcome}
      className={className}
    >
      {/* Keyed by kind+round so the win glow / shimmer replays on every settle. */}
      <div
        key={`${kind}-${round}`}
        className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${style.box} ${bigWin ? BIG_WIN_BOX : ""}`}
      >
        {kind === "win" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/15 to-transparent"
          />
        )}
        <div className="relative flex items-start gap-3">
          <span aria-hidden="true" className={`text-2xl leading-none ${kind === "pending" ? "animate-pulse" : ""}`}>
            {bigWin ? "🏆" : style.icon}
          </span>
          <div className="min-w-0">
            {bigWin && <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Big win</p>}
            <p className={`font-display text-lg font-semibold leading-snug ${bigWin ? "text-amber-200" : style.title}`}>{title}</p>
            {detail && <p className="mt-0.5 text-sm text-ink-muted">{detail}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
