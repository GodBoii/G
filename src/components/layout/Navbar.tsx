"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BalancePill } from "./BalancePill";

const links = [
  { href: "/", label: "Lobby", icon: "⌂" },
  { href: "/teen-patti", label: "Teen Patti", icon: "♠" },
  { href: "/roulette", label: "Roulette", icon: "◉" },
];

export function Navbar() {
  const pathname = usePathname();
  const current = links.find((link) => link.href === pathname);

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="House 37 lobby">
          <span className="brand-mark" aria-hidden="true">♠</span>
          <span>HOUSE<span className="accent">37</span></span>
        </Link>
        <p className="location">Arcade <span aria-hidden="true">/</span> {current?.label ?? "Page unavailable"}</p>
        <BalancePill />
      </header>
      <aside className="sidebar">
        <span className="sidebar-label">ARCADE</span>
        <nav className="nav" aria-label="Arcade">
          {links.map(({ href, label, icon }) => (
            <Link key={href} href={href} aria-current={href === pathname ? "page" : undefined}>
              <span aria-hidden="true">{icon}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="chip-symbol" aria-hidden="true">✦</span>
          <div><strong>Practice mode</strong><p>Virtual chips only</p></div>
        </div>
      </aside>
    </>
  );
}
