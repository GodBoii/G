import Link from "next/link";

export function TableHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="game-heading">
      <Link className="back-link" href="/"><span aria-hidden="true">←</span> Lobby</Link>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
