import { NumberDrawGame } from "@/components/games/NumberDrawGame";
import { GamePageShell } from "@/components/ui/GamePageShell";
import { NUMBER_RULES, type NumberGameKind } from "@/lib/logic/numbers";
import { formatMultiplier } from "@/lib/money";

export function NumberGamePage({ kind }: { kind: NumberGameKind }) {
  const rules = NUMBER_RULES[kind];
  return (
    <GamePageShell slug={kind} rules={
      <>
        <p>{rules.instruction}</p>
        <ol>
          <li>{kind === "seven-up-down" ? "Choose Under 7, Exactly 7, or Over 7." : `Enter your ${rules.digits}-digit number.`}</li>
          <li>Set your demo-credit bet and start the draw.</li>
          <li>The draw settles automatically and appears in your round history.</li>
        </ol>
        {kind === "seven-up-down" ? (
          <ul>
            <li>Under 7 wins on totals 2 through 6. Over 7 wins on totals 8 through 12. Each pays 2.28x with a 15 in 36 chance.</li>
            <li>Exactly 7 pays 5.70x with a 6 in 36 chance. A total of 7 loses both Under and Over bets.</li>
            <li>Each die is drawn independently from 1 through 6.</li>
          </ul>
        ) : <p>Each digit is drawn independently from 0 through 9. An exact match pays {formatMultiplier(rules.multiplierX100, 100)} with a {rules.chance} chance.</p>}
        <p>Payouts include your stake. The theoretical return is {rules.rtp}. Every round is independent. Demo credits only.</p>
      </>
    }>
      <NumberDrawGame kind={kind} />
    </GamePageShell>
  );
}
