import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { GAMES } from "@/lib/games";

// Decorative floating cluster; positions are static so render stays pure.
const FLOATERS: { left: string; top: string; size: string; delay: string }[] = [
  { left: "8%", top: "10%", size: "text-5xl", delay: "0s" },
  { left: "58%", top: "4%", size: "text-6xl", delay: "-1.2s" },
  { left: "30%", top: "38%", size: "text-7xl", delay: "-2.4s" },
  { left: "74%", top: "44%", size: "text-5xl", delay: "-3.1s" },
  { left: "4%", top: "64%", size: "text-6xl", delay: "-4.2s" },
  { left: "48%", top: "72%", size: "text-5xl", delay: "-0.6s" },
];

export function Hero() {
  const icons = GAMES.slice(0, FLOATERS.length).map((g) => g.icon);
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-8 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-14">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
          <span aria-hidden="true">🪙</span>
          Demo credits · No real money
        </span>
        <h1 className="mt-5 max-w-3xl bg-linear-to-r from-fuchsia-300 via-pink-200 to-amber-200 bg-clip-text font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-5xl lg:text-6xl">
          Play 10 arcade games with free demo credits
        </h1>
        <p className="mt-5 max-w-2xl text-base text-ink-muted sm:text-lg">
          Slots, a prize wheel, five instant-win games, Mines, Plinko, and a Satta Matka simulation. Every result comes
          from your browser&apos;s secure random number generator.
        </p>
        <p className="mt-3 text-sm text-ink-faint">Everyone starts with 1,000 demo credits. Top up any time.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#games" className={buttonClasses("primary", "lg")}>
            Browse games
          </a>
          <Link href="/slots" className={buttonClasses("secondary", "lg")}>
            <span aria-hidden="true">🎰</span> Spin the slots
          </Link>
        </div>
      </div>

      <div aria-hidden="true" className="relative mx-auto hidden aspect-square w-full max-w-sm sm:block">
        <div className="absolute inset-[12%] rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute inset-[30%] rounded-full bg-amber-400/20 blur-2xl" />
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className={`absolute animate-float drop-shadow-[0_8px_24px_rgb(217_70_239/.45)] ${f.size}`}
            style={{ left: f.left, top: f.top, animationDelay: f.delay }}
          >
            {icons[i]}
          </span>
        ))}
      </div>
    </section>
  );
}
