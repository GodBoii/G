import type { Metadata } from "next";
import { RouletteGame } from "@/components/games/RouletteGame";

export const metadata: Metadata = {
  title: "European roulette",
  description: "Make a prediction and spin the European single-zero roulette wheel.",
};

export default function RoulettePage() {
  return <RouletteGame />;
}
