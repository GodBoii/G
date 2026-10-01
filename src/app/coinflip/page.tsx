import type { Metadata } from "next";
import { CoinFlipGame } from "@/components/games/CoinFlipGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { COIN_PAYOUT_X100 } from "@/lib/logic/coinflip";
import { formatMultiplier } from "@/lib/money";

const game = getGame("coinflip");

export const metadata: Metadata = { title: game.name, description: game.description };

export default function CoinFlipPage() {
  const payout = formatMultiplier(COIN_PAYOUT_X100, 100);
  return (
    <GamePageShell
      slug="coinflip"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Enter your bet in demo credits.</li>
            <li>Call Heads or Tails.</li>
            <li>Press Flip coin. If the coin lands on your call, you win.</li>
          </ol>
          <h3>Payouts and odds</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Result</th>
                <th scope="col">Chance</th>
                <th scope="col">Payout</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Correct call</td>
                <td>50%</td>
                <td>{payout} your bet</td>
              </tr>
              <tr>
                <td>Wrong call</td>
                <td>50%</td>
                <td>{formatMultiplier(0, 100)}</td>
              </tr>
            </tbody>
          </table>
          <p>
            Return to player: <strong>{COIN_PAYOUT_X100 / 2}%</strong>. Every flip uses your browser&apos;s secure random number generator and is
            independent of earlier flips.
          </p>
        </>
      }
    >
      <CoinFlipGame />
    </GamePageShell>
  );
}
