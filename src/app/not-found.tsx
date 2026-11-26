import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found">
      <span className="eyebrow">PAGE UNAVAILABLE</span>
      <h1>This table is closed.</h1>
      <p>Find Teen Patti and roulette in the lobby.</p>
      <Link className="primary" href="/">Back to lobby <span aria-hidden="true">↗</span></Link>
    </section>
  );
}
