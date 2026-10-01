import type { Metadata } from "next";
import { MinesGame } from "@/components/games/MinesGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { MINES_DEFAULT, MINES_MAX, MINES_MIN, MINES_TILES, minesMultiplierHundredths } from "@/lib/logic/mines";
import { formatMultiplier } from "@/lib/money";

const game = getGame("mines");

export const metadata: Metadata = { title: game.name, description: game.description };

const EXAMPLE_MINES = [1, 3, 5, 10, 24] as const;
const EXAMPLE_GEMS = [1, 2, 3, 5, 10] as const;

export default function MinesPage() {
  return (
    <GamePageShell
      slug="mines"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>
              Choose how many mines to hide ({MINES_MIN}–{MINES_MAX}, default {MINES_DEFAULT}) on the {MINES_TILES}-tile board.
            </li>
            <li>Set your bet and press Start. The bet is taken when the round starts.</li>
            <li>Reveal tiles one at a time. Each gem 💎 raises your multiplier.</li>
            <li>Press Cash out at any time after your first gem to collect bet × multiplier.</li>
          </ol>
          <ul>
            <li>Reveal a mine 💣 and the round ends with no payout.</li>
            <li>Reveal every safe tile and you are cashed out automatically.</li>
            <li>When the round ends, the whole board is shown.</li>
            <li>
              <strong>Leaving or reloading the page mid-round forfeits the bet.</strong>
            </li>
          </ul>
          <h3>Payouts</h3>
          <p>
            The multiplier after k gems is 0.99 × C(25, k) / C(25 − mines, k), rounded down to 2 decimals. Return to player is
            99% at every step.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th scope="col">Mines \ gems</th>
                  {EXAMPLE_GEMS.map((g) => (
                    <th key={g} scope="col">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_MINES.map((m) => (
                  <tr key={m}>
                    <th scope="row">{m}</th>
                    {EXAMPLE_GEMS.map((g) => (
                      <td key={g}>{g <= MINES_TILES - m ? formatMultiplier(minesMultiplierHundredths(m, g), 100) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
    >
      <MinesGame />
    </GamePageShell>
  );
}
