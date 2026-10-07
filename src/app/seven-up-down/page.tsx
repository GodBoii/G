import type { Metadata } from "next";
import { NumberGamePage } from "@/components/ui/NumberGamePage";
import { getGame } from "@/lib/games";

const game = getGame("seven-up-down");
export const metadata: Metadata = { title: game.name, description: game.description };

export default function SevenUpDownPage() {
  return <NumberGamePage kind="seven-up-down" />;
}
