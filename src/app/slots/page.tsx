import type { Metadata } from "next";
import { SlotsGame } from "@/components/games/SlotsGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { getGame } from "@/lib/games";
import { SLOT_LINES, SLOT_PAYLINES, SLOT_REELS, SLOT_ROWS, SLOT_SYMBOLS } from "@/lib/logic/slots";
import { formatMultiplier } from "@/lib/money";

const game = getGame("slots");

export const metadata: Metadata = { title: game.name, description: game.description };

const ROW_NAMES = ["top", "middle", "bottom"] as const;
const REELS = Array.from({ length: SLOT_REELS }, (_, i) => i);
const ROWS = Array.from({ length: SLOT_ROWS }, (_, r) => r);

function PaylineDiagram({ line, rows }: { line: number; rows: readonly number[] }) {
  return (
    <figure className="rounded-xl border border-white/10 bg-white/5 p-2">
      <div
        role="img"
        aria-label={`Line ${line}: ${rows.map((r) => ROW_NAMES[r]).join(", ")}`}
        className="grid grid-cols-5 gap-1"
      >
        {ROWS.map((r) =>
          REELS.map((reel) => (
            <span
              key={`${r}-${reel}`}
              className={`aspect-square rounded-sm ${rows[reel] === r ? "bg-amber-300" : "bg-white/10"}`}
            />
          )),
        )}
      </div>
      <figcaption className="mt-1.5 text-center text-xs font-semibold text-ink">Line {line}</figcaption>
    </figure>
  );
}

export default function SlotsPage() {
  return (
    <GamePageShell
      slug="slots"
      rules={
        <>
          <h3>How to play</h3>
          <ol>
            <li>Enter your total bet in demo credits. It is split evenly across all {SLOT_LINES} lines.</li>
            <li>Press Spin. Each of the 15 positions lands on a symbol independently.</li>
            <li>
              A line wins with 3, 4, or 5 identical symbols in a row, starting from the leftmost reel. Wins on different lines add
              together.
            </li>
          </ol>
          <h3>Paytable (multiples of your total bet)</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Chance per position</th>
                <th scope="col">3 in a row</th>
                <th scope="col">4 in a row</th>
                <th scope="col">5 in a row</th>
              </tr>
            </thead>
            <tbody>
              {SLOT_SYMBOLS.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span aria-hidden="true">{s.emoji}</span> {s.name}
                  </td>
                  <td>{s.weight}%</td>
                  {s.payTenths.map((t, k) => (
                    <td key={k}>{formatMultiplier(t, 10)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            There are no wilds or scatters. Return to player: <strong>96.99%</strong>.
          </p>
          <h3>Paylines</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SLOT_PAYLINES.map((rows, i) => (
              <PaylineDiagram key={i} line={i + 1} rows={rows} />
            ))}
          </div>
        </>
      }
    >
      <SlotsGame />
    </GamePageShell>
  );
}
