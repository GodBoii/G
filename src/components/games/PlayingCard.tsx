import type { Card } from "@/lib/logic/teenPatti";

const marks = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
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
            <span className="card-suit">{mark}</span>
            <span className="card-index card-index-bottom">{rank?.letter ?? card.rank}<small>{mark}</small></span>
          </div>
        )}
      </div>
    </div>
  );
}
