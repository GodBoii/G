import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { WalletProvider } from "@/context/WalletContext";
import "./globals.css";

export const metadata: Metadata = {
  title: { template: "%s | House 37", default: "House 37 — Card & Wheel Arcade" },
  description: "Play heads-up Teen Patti and European roulette with virtual chips at House 37.",
  openGraph: {
    title: "House 37 — Card & Wheel Arcade",
    description: "Two classic tables. Free to play with virtual chips.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <WalletProvider>
          <div className="house">
            <Navbar />
            <main id="main" className="main">
              <div className="content">{children}</div>
              <footer className="footer">
                <span>HOUSE<span className="accent">37</span></span>
                <p>Free play with virtual chips. No cash value.</p>
              </footer>
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
