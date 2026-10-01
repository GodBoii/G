import { GameCard } from "@/components/home/GameCard";
import { Hero } from "@/components/home/Hero";
import { GAMES } from "@/lib/games";

export default function Home() {
  return (
    <>
      <Hero />
      <section id="games" aria-labelledby="games-heading" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="games-heading" className="font-display text-2xl font-bold text-ink sm:text-3xl">
            All games
          </h2>
          <p className="text-sm text-ink-faint">10 tables · demo credits only</p>
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {GAMES.map((game) => (
            <li key={game.slug}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
