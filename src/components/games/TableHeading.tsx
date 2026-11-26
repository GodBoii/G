import Link from "next/link";

export function TableHeading({ title, description, icon, theme }: {
  title: string;
  description: string;
  icon: string;
  theme?: "roulette";
}) {
  return (
    <header className="game-heading" data-theme={theme}>
      <Link className="back-link" href="/">‹&nbsp; Lobby</Link>
      <div className="game-title">
        <span className="game-emblem" aria-hidden="true">{icon}</span>
        <div><h1>{title}</h1><p>{description}</p></div>
      </div>
    </header>
  );
}
