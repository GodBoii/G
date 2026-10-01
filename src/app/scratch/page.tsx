import type { Metadata } from "next";
import { ScratchGame } from "@/components/games/ScratchGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import {
  SCRATCH_EMOJI,
  SCRATCH_LOSE_PPM,
  SCRATCH_NAMES,
  SCRATCH_ODDS_PPM,
  SCRATCH_PRIZES_X100,
  SCRATCH_SYMBOLS,
} from "@/lib/logic/scratch";
import { formatMultiplier } from "@/lib/money";

const game = getGame("scratch");

export const metadata: Metadata = { title: game.name, description: game.description };

/** Parts per million → "0.1%". */
function ppmPercent(ppm: number): string {
  return `${ppm / 10_000}%`;
}

export default function ScratchPage() {
  return (
    <GamePageShell
      slug="scratch"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Set your bet and press Buy card. The bet is taken when you buy.</li>
            <li>Scratch the silver foil with your mouse or finger. Once about half is scratched, the card reveals itself.</li>
            <li>Or press Reveal all to uncover the whole card at once (works with the keyboard too).</li>
          </ol>
          <p>
            Three identical symbols anywhere on the 9 cells win that symbol&apos;s prize. A card never has more than one
            winning triple. You need to finish a card before you can buy the next one.
          </p>
          <h3>Prizes</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Pays</th>
                <th scope="col">Chance</th>
              </tr>
            </thead>
            <tbody>
              {SCRATCH_SYMBOLS.map((s) => (
                <tr key={s}>
                  <td>
                    {SCRATCH_EMOJI[s]} {SCRATCH_NAMES[s]}
                  </td>
                  <td>
                    {formatMultiplier(SCRATCH_PRIZES_X100[s], 100)}
                    {s === "cherry" ? " (money back)" : ""}
                  </td>
                  <td>{ppmPercent(SCRATCH_ODDS_PPM[s])}</td>
                </tr>
              ))}
              <tr>
                <td>No match</td>
                <td>{formatMultiplier(0, 100)}</td>
                <td>{ppmPercent(SCRATCH_LOSE_PPM)}</td>
              </tr>
            </tbody>
          </table>
          <p>Return to player is 96.0%. A prize (including money back) comes up on 43.1% of cards.</p>
        </>
      }
    >
      <ScratchGame />
    </GamePageShell>
  );
}
