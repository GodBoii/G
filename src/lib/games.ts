// Game registry: home grid, navbar, GamePageShell, and page metadata all read from here.

export type GameCategory = "Slots" | "Wheel" | "Instant Win" | "Mines" | "Plinko" | "Number Game";

export interface GameMeta {
  slug: "slots" | "wheel" | "scratch" | "dice" | "coinflip" | "limbo" | "keno" | "mines" | "plinko" | "satta-matka";
  href: `/${string}`;
  name: string; // = page h1
  navLabel: string;
  description: string;
  tagline: string;
  category: GameCategory;
  icon: string; // emoji
  /** Full static Tailwind class strings (JIT-safe). */
  accent: { from: string; to: string; ring: string };
}

export const GAMES: readonly GameMeta[] = [
  {
    slug: "slots",
    href: "/slots",
    name: "Neon Slots",
    navLabel: "Slots",
    description: "Spin five neon reels across 10 fixed paylines. Match 3, 4, or 5 symbols from the left to win demo credits.",
    tagline: "Line up sevens for up to 1000x",
    category: "Slots",
    icon: "🎰",
    accent: { from: "from-fuchsia-500", to: "to-violet-500", ring: "ring-fuchsia-400/60" },
  },
  {
    slug: "wheel",
    href: "/wheel",
    name: "Wheel of Fortune",
    navLabel: "Wheel",
    description: "Spin a 40-segment prize wheel and see where the pointer lands. Multipliers range from 1.5x to 10x.",
    tagline: "One spin, up to 10x your demo credits",
    category: "Wheel",
    icon: "🎡",
    accent: { from: "from-amber-400", to: "to-orange-500", ring: "ring-amber-400/60" },
  },
  {
    slug: "scratch",
    href: "/scratch",
    name: "Scratch Card",
    navLabel: "Scratch",
    description: "Buy a card and scratch off the foil. Find three matching symbols to win up to 100x in demo credits.",
    tagline: "Scratch three of a kind",
    category: "Instant Win",
    icon: "🎟️",
    accent: { from: "from-emerald-500", to: "to-teal-500", ring: "ring-emerald-400/60" },
  },
  {
    slug: "dice",
    href: "/dice",
    name: "Dice",
    navLabel: "Dice",
    description: "Pick a target and roll over or under it. Lower win chances pay bigger multipliers in demo credits.",
    tagline: "Set your odds, then roll",
    category: "Instant Win",
    icon: "🎲",
    accent: { from: "from-sky-500", to: "to-indigo-500", ring: "ring-sky-400/60" },
  },
  {
    slug: "coinflip",
    href: "/coinflip",
    name: "Coin Flip",
    navLabel: "Coin Flip",
    description: "Call heads or tails and flip the coin. A correct call pays 1.98x in demo credits.",
    tagline: "Heads or tails, 1.98x",
    category: "Instant Win",
    icon: "🪙",
    accent: { from: "from-amber-400", to: "to-yellow-400", ring: "ring-amber-300/60" },
  },
  {
    slug: "limbo",
    href: "/limbo",
    name: "Limbo",
    navLabel: "Limbo",
    description: "Set a target multiplier and launch. If the rocket climbs past your target, you win demo credits at that multiplier.",
    tagline: "Aim high, up to 1,000,000x",
    category: "Instant Win",
    icon: "🚀",
    accent: { from: "from-rose-500", to: "to-fuchsia-500", ring: "ring-rose-400/60" },
  },
  {
    slug: "keno",
    href: "/keno",
    name: "Keno",
    navLabel: "Keno",
    description: "Pick up to 10 numbers from 40, then watch 10 get drawn. More hits pay more demo credits.",
    tagline: "Pick your numbers, match the draw",
    category: "Instant Win",
    icon: "🔢",
    accent: { from: "from-cyan-500", to: "to-sky-500", ring: "ring-cyan-400/60" },
  },
  {
    slug: "mines",
    href: "/mines",
    name: "Mines",
    navLabel: "Mines",
    description: "Uncover gems on a 5×5 grid while avoiding hidden mines. Collect your demo credits any time before you hit one.",
    tagline: "Find gems, dodge mines",
    category: "Mines",
    icon: "💣",
    accent: { from: "from-emerald-500", to: "to-lime-500", ring: "ring-emerald-400/60" },
  },
  {
    slug: "plinko",
    href: "/plinko",
    name: "Plinko",
    navLabel: "Plinko",
    description: "Drop balls through a field of pegs and see which bucket they land in. Choose rows and risk for bigger demo credit swings.",
    tagline: "Drop the ball, chase the edges",
    category: "Plinko",
    icon: "🔻",
    accent: { from: "from-violet-500", to: "to-fuchsia-500", ring: "ring-violet-400/60" },
  },
  {
    slug: "satta-matka",
    href: "/satta-matka",
    name: "Satta Matka",
    navLabel: "Matka",
    description: "A simulated number game. Bet demo credits on single digits, jodi pairs, or pannas and see the open and close draw.",
    tagline: "Single, Jodi, or Panna",
    category: "Number Game",
    icon: "🃏",
    accent: { from: "from-orange-500", to: "to-rose-500", ring: "ring-orange-400/60" },
  },
];

export function getGame(slug: GameMeta["slug"]): GameMeta {
  const game = GAMES.find((g) => g.slug === slug);
  if (!game) throw new Error(`Unknown game slug: ${slug}`);
  return game;
}
