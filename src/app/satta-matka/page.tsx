import type { Metadata } from "next";
import { SattaMatkaGame } from "@/components/games/SattaMatkaGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { MATKA_BET_LABELS, MATKA_BET_TYPES, MATKA_PAYOUTS, MATKA_RTP_PERCENT, type MatkaBetType } from "@/lib/logic/matka";
import { formatMultiplier } from "@/lib/money";

const game = getGame("satta-matka");

export const metadata: Metadata = { title: game.name, description: game.description };

const BET_RULES: Record<MatkaBetType, { input: string; wins: string }> = {
  single: { input: "One digit 0–9", wins: "The chosen side's ank equals your digit" },
  jodi: { input: "Two digits 00–99", wins: "Open ank followed by close ank equals your number" },
  singlePanna: { input: "Three different digits", wins: "The chosen side's panna equals your panna" },
  doublePanna: { input: "Exactly two equal digits", wins: "The chosen side's panna equals your panna" },
  triplePanna: { input: "Three equal digits", wins: "The chosen side's panna equals your panna" },
};

export default function SattaMatkaPage() {
  return (
    <GamePageShell
      slug="satta-matka"
      rules={
        <>
          <p>
            <strong>Simulation only.</strong> This is a random number game played with demo credits. There are no real
            markets, timings, or money.
          </p>
          <h3>The draw</h3>
          <ul>
            <li>
              A <strong>panna</strong> is three random digits. Two pannas are drawn every round: <strong>Open</strong> and{" "}
              <strong>Close</strong>.
            </li>
            <li>
              Pannas are written in canonical order: digits sorted ascending, with 0 counted as 10. So 721 is written 127, 012
              is 120, and 005 is 500.
            </li>
            <li>
              The <strong>ank</strong> of a panna is the last digit of its digit sum (1 + 3 + 7 = 11, ank 1).
            </li>
            <li>
              The <strong>jodi</strong> is the open ank followed by the close ank.
            </li>
            <li>
              The result reads <strong>open panna – jodi – close panna</strong>, for example 137-17-250.
            </li>
            <li>One draw settles both the Open and Close sides at once.</li>
          </ul>
          <h3>How to play</h3>
          <ol>
            <li>Choose a bet type. Single and Panna bets also need a side (Open or Close); Jodi covers both.</li>
            <li>Pick your digit, or type your number (leading zeros count, like 05 or 000).</li>
            <li>Set your bet and press Place bet &amp; draw.</li>
          </ol>
          <h3>Payouts</h3>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th scope="col">Bet</th>
                  <th scope="col">Input</th>
                  <th scope="col">Wins when</th>
                  <th scope="col">Pays</th>
                  <th scope="col">RTP</th>
                </tr>
              </thead>
              <tbody>
                {MATKA_BET_TYPES.map((t) => (
                  <tr key={t}>
                    <td>{MATKA_BET_LABELS[t]}</td>
                    <td>{BET_RULES[t].input}</td>
                    <td>{BET_RULES[t].wins}</td>
                    <td>{formatMultiplier(MATKA_PAYOUTS[t], 1)}</td>
                    <td>{MATKA_RTP_PERCENT[t]}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>Payouts are gross (your stake included). The result chart keeps the last 30 draws on this device.</p>
        </>
      }
    >
      <SattaMatkaGame />
    </GamePageShell>
  );
}
