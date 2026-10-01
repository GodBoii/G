import type { Metadata } from "next";
import { PlinkoGame } from "@/components/games/PlinkoGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { PLINKO_DEFAULT_ROWS, PLINKO_RISKS, PLINKO_ROWS, PLINKO_X10 } from "@/lib/logic/plinko";
import { formatMultiplier } from "@/lib/money";

const game = getGame("plinko");

export const metadata: Metadata = { title: game.name, description: game.description };

const RISK_NAMES = { low: "Low", medium: "Medium", high: "High" } as const;

export default function PlinkoPage() {
  return (
    <GamePageShell
      slug="plinko"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Choose the number of rows (8–16, default {PLINKO_DEFAULT_ROWS}) and a risk level.</li>
            <li>Set your bet and press Drop ball. Each drop is its own bet, and up to 20 balls can be in the air.</li>
            <li>At every peg the ball bounces left or right with equal chance. The bucket it lands in sets the multiplier.</li>
          </ol>
          <p>
            Edge buckets are rare and pay the most; centre buckets are common and pay the least. Higher risk widens that gap.
            Rows and risk can be changed once every ball has landed. Return to player is about 99% for every setting.
          </p>
          <h3>Edge and centre multipliers</h3>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th scope="col">Rows</th>
                  {PLINKO_RISKS.map((risk) => (
                    <th key={risk} scope="col">
                      {RISK_NAMES[risk]} (edge / centre)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLINKO_ROWS.map((rows) => (
                  <tr key={rows}>
                    <th scope="row">{rows}</th>
                    {PLINKO_RISKS.map((risk) => {
                      const table = PLINKO_X10[rows][risk];
                      return (
                        <td key={risk}>
                          {formatMultiplier(table[0], 10)} / {formatMultiplier(table[Math.floor(rows / 2)], 10)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>The full bucket row for the current setting is shown under the board.</p>
        </>
      }
    >
      <PlinkoGame />
    </GamePageShell>
  );
}
