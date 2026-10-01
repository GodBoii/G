import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { WalletProvider } from "@/context/WalletContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: { template: "%s | Gamess", default: "Gamess | Demo Credit Arcade" },
  description:
    "Play 10 arcade games with free demo credits: slots, a prize wheel, five instant-win games, Mines, Plinko, and a Satta Matka simulation. No real money.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="flex min-h-dvh flex-col bg-bg-950 font-sans text-ink antialiased">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-bg-900 to-bg-950">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute -left-40 -top-40 size-[36rem] rounded-full bg-fuchsia-600/20 blur-3xl" />
          <div className="absolute -right-40 -top-24 size-[32rem] rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute -bottom-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
        </div>
        <a
          href="#main"
          className="sr-only rounded-xl bg-amber-300 px-4 py-2 font-semibold text-bg-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to game
        </a>
        <WalletProvider>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
