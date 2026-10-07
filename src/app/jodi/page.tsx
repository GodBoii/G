import type { Metadata } from "next";
import { NumberGamePage } from "@/components/ui/NumberGamePage";
import { getGame } from "@/lib/games";

const game = getGame("jodi");
export const metadata: Metadata = { title: game.name, description: game.description };

export default function JodiPage() {
  return <NumberGamePage kind="jodi" />;
}
