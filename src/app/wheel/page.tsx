import type { Metadata } from "next";
import { WheelGame } from "@/components/games/WheelGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { WHEEL_SEGMENTS_X10, WHEEL_SEGMENT_COUNT } from "@/lib/logic/wheel";
import { formatMultiplier } from "@/lib/money";

const game = getGame("wheel");

export const metadata: Metadata = { title: game.name, description: game.description };

// Distribution derived from the paying table, highest multiplier first.
const DISTRIBUTION = Array.from(new Set<number>(WHEEL_SEGMENTS_X10))
  .sort((a, b) => b - a)
  .map((v) => {
    const count = WHEEL_SEGMENTS_X10.filter((s) => s === v).length;
    return { v, count, percent: (count * 100) / WHEEL_SEGMENT_COUNT };
  });

const TOTAL_X10 = WHEEL_SEGMENTS_X10.reduce<number>((sum, v) => sum + v, 0);
// RTP % = average multiplier × 100 = TOTAL_X10 / 10 / count × 100.
const RTP_PERCENT = (TOTAL_X10 * 10) / WHEEL_SEGMENT_COUNT;
const HIT_PERCENT = (WHEEL_SEGMENTS_X10.filter((v) => v > 0).length * 100) / WHEEL_SEGMENT_COUNT;

export default function WheelPage() {
  return (
    <GamePageShell
      slug="wheel"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Enter your bet in demo credits.</li>
            <li>Press Spin wheel. The wheel spins and slows to a stop.</li>
            <li>The segment under the pointer at the top sets your multiplier. Your payout is your bet times that multiplier.</li>
          </ol>
          <h3>Segments and odds</h3>
          <p>
            The wheel has {WHEEL_SEGMENT_COUNT} equal segments, and every segment is equally likely.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Multiplier</th>
                <th scope="col">Segments</th>
                <th scope="col">Chance</th>
              </tr>
            </thead>
            <tbody>
              {DISTRIBUTION.map((row) => (
                <tr key={row.v}>
                  <td>{formatMultiplier(row.v, 10)}</td>
                  <td>{row.count}</td>
                  <td>{row.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Return to player: <strong>{RTP_PERCENT}%</strong>. A spin returns something {HIT_PERCENT}% of the time.
          </p>
        </>
      }
    >
      <WheelGame />
    </GamePageShell>
  );
}
