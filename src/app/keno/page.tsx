import type { Metadata } from "next";
import { KenoGame } from "@/components/games/KenoGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { KENO_DRAWS, KENO_MAX_PICKS, KENO_NUMBERS, KENO_PAYTABLE, type KenoPicks } from "@/lib/logic/keno";
import { formatMultiplier } from "@/lib/money";

const game = getGame("keno");

export const metadata: Metadata = { title: game.name, description: game.description };

const PICK_COUNTS: readonly KenoPicks[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HIT_COLUMNS = Array.from({ length: KENO_MAX_PICKS + 1 }, (_, h) => h);

export default function KenoPage() {
  return (
    <GamePageShell
      slug="keno"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>
              Pick 1 to {KENO_MAX_PICKS} numbers from 1 to {KENO_NUMBERS}, or press Quick pick.
            </li>
            <li>Set your bet and press Play.</li>
            <li>
              {KENO_DRAWS} numbers are drawn at random. Each drawn number you picked is a hit. Your payout depends on how many
              numbers you picked and how many of them hit.
            </li>
          </ol>
          <p>Your picks stay on the board between rounds, so you can replay the same numbers.</p>
          <h3>Paytable</h3>
          <p>Gross payout multipliers (your stake included) by picks and hits. Return to player is between 95.7% and 97.1%.</p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th scope="col">Picks \ hits</th>
                  {HIT_COLUMNS.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PICK_COUNTS.map((p) => (
                  <tr key={p}>
                    <th scope="row">{p}</th>
                    {HIT_COLUMNS.map((h) => (
                      <td key={h}>{h <= p ? formatMultiplier(KENO_PAYTABLE[p][h], 100) : ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
    >
      <KenoGame />
    </GamePageShell>
  );
}
