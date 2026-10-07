import type { Metadata } from "next";
import { NumberGamePage } from "@/components/ui/NumberGamePage";
import { getGame } from "@/lib/games";

const game = getGame("pick3");
export const metadata: Metadata = { title: game.name, description: game.description };

export default function Pick3Page() {
  return <NumberGamePage kind="pick3" />;
}
