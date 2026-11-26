import type { Metadata } from "next";
import { RouletteGame } from "@/components/games/RouletteGame";

export const metadata: Metadata = {
  title: "European roulette",
  description: "Place virtual chips on the European single-zero roulette board.",
};

export default function RoulettePage() {
  return <RouletteGame />;
}
