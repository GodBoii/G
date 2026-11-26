import type { Card } from "@/lib/logic/teenPatti";

const marks = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
// Columns of a traditional pip layout, read left to right.
const pipColumns: Record<number, number[]> = {
  2: [2], 3: [3], 4: [2, 0, 2], 5: [2, 1, 2], 6: [3, 0, 3],
  7: [3, 1, 3], 8: [3, 2, 3], 9: [4, 1, 4], 10: [4, 2, 4],
};
const courtMarks: Record<number, string> = { 11: "♞", 12: "♛", 13: "♚" };
const ranks: Record<number, { letter: string; name: string }> = {
  11: { letter: "J", name: "Jack" },
  12: { letter: "Q", name: "Queen" },
  13: { letter: "K", name: "King" },
  14: { letter: "A", name: "Ace" },
};

export function PlayingCard({ card }: { card?: Card }) {
  const rank = card ? ranks[card.rank] : undefined;
  const mark = card ? marks[card.suit] : undefined;
  const red = card?.suit === "hearts" || card?.suit === "diamonds";

  return (
    <div className="playing-card" data-revealed={Boolean(card)} role="img"
      aria-label={card ? `${rank?.name ?? card.rank} of ${card.suit}` : "Face-down card"}>
      <div className="card-turn" aria-hidden="true">
        <div className="card-side card-back"><span>✦</span></div>
        {card && (
          <div className="card-side card-face" data-red={red}>
            <span className="card-index">{rank?.letter ?? card.rank}<small>{mark}</small></span>
            {pipColumns[card.rank] ? (
              <span className="card-pips">
                {pipColumns[card.rank].map((count, column) => (
                  <span className="pip-column" key={column}>
                    {Array.from({ length: count }, (_, row) => <i key={row}>{mark}</i>)}
                  </span>
                ))}
              </span>
            ) : <span className="card-suit">{courtMarks[card.rank] ?? mark}</span>}
            <span className="card-index card-index-bottom">{rank?.letter ?? card.rank}<small>{mark}</small></span>
          </div>
        )}
      </div>
    </div>
  );
}
