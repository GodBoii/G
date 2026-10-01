import type { ReactNode } from "react";

export interface GameLayoutProps {
  board: ReactNode;
  controls: ReactNode;
  result: ReactNode;
  history: ReactNode;
  /** Accessible name of the board region. */
  boardLabel: string;
}

/**
 * Mobile: board → controls → result → history. Desktop (lg): board left, sticky result + controls
 * column right, history under the board. Exactly ONE DOM node per slot (the side wrapper is
 * display: contents on mobile), so the result live region is never duplicated.
 */
export function GameLayout({ board, controls, result, history, boardLabel }: GameLayoutProps) {
  return (
    <div className="grid gap-4 [grid-template-areas:'board'_'controls'_'result'_'history'] lg:grid-cols-[minmax(0,1fr)_22rem] lg:[grid-template-areas:'board_side'_'history_side']">
      <section aria-label={boardLabel} className="glass min-w-0 p-4 [grid-area:board] sm:p-6 lg:min-h-[22rem]">
        {board}
      </section>
      <div className="contents lg:sticky lg:top-28 lg:flex lg:flex-col lg:gap-4 lg:self-start lg:[grid-area:side]">
        <div className="min-w-0 [grid-area:result]">{result}</div>
        <div className="glass min-w-0 p-4 [grid-area:controls] sm:p-5">{controls}</div>
      </div>
      <div className="glass min-w-0 p-4 [grid-area:history] sm:p-5">{history}</div>
    </div>
  );
}
