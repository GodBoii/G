import type { Metadata } from "next";
import { LimboGame } from "@/components/games/LimboGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { LIMBO_MAX_H, LIMBO_MIN_TARGET_H, limboWinChanceText } from "@/lib/logic/limbo";
import { formatMultiplier } from "@/lib/money";

const game = getGame("limbo");

export const metadata: Metadata = { title: game.name, description: game.description };

const EXAMPLE_TARGETS_H = [LIMBO_MIN_TARGET_H, 150, 200, 500, 1000, 10000, 100000] as const;

export default function LimboPage() {
  return (
    <GamePageShell
      slug="limbo"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>
              Set a target multiplier from {formatMultiplier(LIMBO_MIN_TARGET_H, 100)} to {formatMultiplier(LIMBO_MAX_H, 100)} (up
              to 2 decimals).
            </li>
            <li>Press Launch. The rocket climbs to a random result multiplier.</li>
            <li>If the result is equal to or higher than your target, you win your bet times the target.</li>
          </ol>
          <h3>Odds</h3>
          <p>
            The win chance is 99% divided by the target. Results start at {formatMultiplier(100, 100)} and are capped at{" "}
            {formatMultiplier(LIMBO_MAX_H, 100)}. Return to player is 99%.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Target</th>
                <th scope="col">Win chance</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_TARGETS_H.map((h) => (
                <tr key={h}>
                  <td>{formatMultiplier(h, 100)}</td>
                  <td>{limboWinChanceText(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      }
    >
      <LimboGame />
    </GamePageShell>
  );
}
