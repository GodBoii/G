import type { Metadata } from "next";
import { DiceGame } from "@/components/games/DiceGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { DICE_MAX_TARGET, DICE_MIN_TARGET, diceMultiplierX10000 } from "@/lib/logic/dice";
import { formatMultiplier } from "@/lib/money";

const game = getGame("dice");

export const metadata: Metadata = { title: game.name, description: game.description };

const EXAMPLE_CHANCES = [DICE_MIN_TARGET, 10, 25, 50, 75, 90, DICE_MAX_TARGET] as const;

export default function DicePage() {
  return (
    <GamePageShell
      slug="dice"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Drag the Target slider to any whole number from {DICE_MIN_TARGET} to {DICE_MAX_TARGET}.</li>
            <li>Choose Roll under or Roll over.</li>
            <li>Press Roll dice. The roll is a number from 0.00 to 99.99.</li>
          </ol>
          <ul>
            <li>
              <strong>Under</strong> wins when the roll is below the target, so the win chance equals the target.
            </li>
            <li>
              <strong>Over</strong> wins when the roll is at or above the target, so the win chance is 100 minus the target.
            </li>
          </ul>
          <h3>Payouts</h3>
          <p>The multiplier is 99 divided by the win chance, rounded down to 4 decimals. Return to player is 99%.</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Win chance</th>
                <th scope="col">Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_CHANCES.map((c) => (
                <tr key={c}>
                  <td>{c}%</td>
                  <td>{formatMultiplier(diceMultiplierX10000(c), 10000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
    >
      <DiceGame />
    </GamePageShell>
  );
}
