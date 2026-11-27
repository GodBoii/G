import Link from "next/link";

export function TableHeading({ title, description, soundEnabled, onToggleSound }: {
  title: string;
  description: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="game-heading">
      <Link className="back-link" href="/"><span aria-hidden="true">←</span> Lobby</Link>
      <button className="sound-toggle" type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>
        Sound <span aria-hidden="true">{soundEnabled ? "on" : "off"}</span>
      </button>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
