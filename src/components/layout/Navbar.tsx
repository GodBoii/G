"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { GAMES } from "@/lib/games";
import { buttonClasses } from "@/components/ui/Button";
import { BalancePill } from "./BalancePill";

function LogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="size-8 shrink-0 drop-shadow-[0_0_10px_rgb(217_70_239/.45)]">
      <defs>
        <linearGradient id="gamess-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d946ef" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#gamess-logo-g)" />
      <text x="32" y="44" fontFamily="Arial, sans-serif" fontSize="36" fontWeight="700" fill="#fff" textAnchor="middle">
        G
      </text>
    </svg>
  );
}

// 36px icon buttons below sm, labelled buttons from sm up (accessible name is the same at every size).
const ACTION_BTN =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-ink transition-[transform,background-color] active:scale-[.97] enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3";

export function Navbar() {
  const pathname = usePathname();
  const { hydrated, reset, topUp } = useWallet();
  // Menu state is tied to the route: any navigation changes pathname, which closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const [announcement, setAnnouncement] = useState("");
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpenFor(null);
      toggleRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    function onChange(e: MediaQueryListEvent) {
      if (e.matches) setOpenFor(null);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function announce(message: string) {
    // A trailing NBSP toggle makes a repeated message announce again.
    setAnnouncement((prev) => (prev === message ? `${message}\u00A0` : message));
  }

  function onTopUp() {
    topUp();
    announce("Added 1,000.00 demo credits");
  }

  function onReset() {
    reset();
    announce("Balance reset to 1,000.00");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-bg-950/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 rounded-lg" aria-label="Gamess home">
          <LogoMark />
          <span className="hidden font-display text-xl font-extrabold tracking-tight text-ink min-[400px]:inline">Gamess</span>
        </Link>

        <BalancePill />

        <button
          type="button"
          className={ACTION_BTN}
          aria-label="Top up 1,000 demo credits"
          title="Top up 1,000 demo credits"
          disabled={!hydrated}
          onClick={onTopUp}
        >
          <span aria-hidden="true" className="text-base leading-none text-emerald-300">
            ＋
          </span>
          <span className="hidden sm:inline">Top up</span>
        </button>
        <button
          type="button"
          className={ACTION_BTN}
          aria-label="Reset balance to 1,000"
          title="Reset balance to 1,000"
          disabled={!hydrated}
          onClick={onReset}
        >
          <span aria-hidden="true" className="text-base leading-none text-sky-300">
            ↺
          </span>
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpenFor(open ? null : pathname)}
          className={`${buttonClasses("secondary", "sm")} md:hidden`}
        >
          <span aria-hidden="true" className="text-base leading-none">
            {open ? "✕" : "☰"}
          </span>
          {open ? "Close" : "Games"}
        </button>

        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>

      <nav aria-label="Games" className="mx-auto hidden max-w-7xl px-4 pb-3 sm:px-6 md:block">
        <ul className="flex flex-wrap justify-center gap-1.5">
          {GAMES.map((g) => {
            const active = pathname === g.href;
            return (
              <li key={g.slug}>
                <Link
                  href={g.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-linear-to-r from-fuchsia-600 to-violet-600 text-white shadow-glow-fuchsia"
                      : "text-ink-muted hover:bg-white/5 hover:text-ink"
                  }`}
                >
                  <span aria-hidden="true">{g.icon}</span>
                  {g.navLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav id="mobile-nav" aria-label="Games menu" hidden={!open} className="border-t border-white/10 px-4 pb-4 pt-3 md:hidden">
        <ul className="grid grid-cols-2 gap-2">
          {GAMES.map((g) => {
            const active = pathname === g.href;
            return (
              <li key={g.slug}>
                <Link
                  href={g.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpenFor(null)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    active
                      ? "border-transparent bg-linear-to-r from-fuchsia-600 to-violet-600 text-white"
                      : "border-white/10 bg-white/5 text-ink hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden="true">{g.icon}</span>
                  {g.navLabel}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
