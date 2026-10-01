import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto mt-12 w-full max-w-7xl px-4 pb-6 sm:px-6">
      <div className="glass flex flex-col items-center gap-3 px-4 py-5 text-center text-sm text-ink-muted sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-semibold text-ink">Demo credits only. For entertainment. No real money.</p>
          <p className="mt-1 text-ink-faint">© Gamess demo arcade</p>
        </div>
        <Link href="/#games" className="rounded-lg font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
          Back to all games
        </Link>
      </div>
    </footer>
  );
}
