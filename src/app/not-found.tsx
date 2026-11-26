import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found">
      <span className="club-mark" aria-hidden="true">✦</span>
      <h1>This table is closed.</h1>
      <p>Teen Patti and roulette are in the lobby.</p>
      <Link className="primary" href="/">Back to lobby <span aria-hidden="true">↗</span></Link>
    </section>
  );
}
