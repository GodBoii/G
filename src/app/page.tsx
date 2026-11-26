import Image from "next/image";
import Link from "next/link";

const tables = [
  {
    href: "/teen-patti", title: "Teen Patti", subtitle: "Three cards. One showdown.",
    image: "/teen-patti-table.webp", icon: "♠", className: "card-table",
  },
  {
    href: "/roulette", title: "Roulette", subtitle: "37 pockets. One winning number.",
    image: "/roulette.webp", icon: "◉", className: "wheel-table",
  },
];

export default function Home() {
  return (
    <div className="lobby">
      <section className="hero" aria-labelledby="lobby-heading">
        <Image className="hero-image" src="/house-banner.webp" alt="" fill sizes="(max-width: 768px) 100vw, 1200px" preload />
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot" /> THE FREE-PLAY ARCADE</span>
          <h1 id="lobby-heading">Your seat is<br /> <em>at the table.</em></h1>
          <p>Play three-card showdowns or take the European wheel for a spin. The chips are on us.</p>
          <a className="primary hero-action" href="#tables">Explore tables <span aria-hidden="true">↘</span></a>
        </div>
      </section>
      <section className="tables" id="tables" aria-labelledby="tables-heading">
        <div className="section-head">
          <div><span className="eyebrow">THE ARCADE</span><h2 id="tables-heading">Pick your table</h2></div>
        </div>
        <div className="table-grid">
          {tables.map((table) => (
            <Link className={`table-card ${table.className}`} key={table.href} href={table.href}>
              <div className="table-image">
                <Image src={table.image} alt="" fill sizes="(max-width: 760px) 100vw, 560px" />
                <span className="table-emblem" aria-hidden="true">{table.icon}</span>
              </div>
              <div className="table-copy">
                <div><h3>{table.title}</h3><p>{table.subtitle}</p></div>
                <span className="table-arrow" aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
