import type { Metadata } from "next";
import "./globals.css";
import "./objects.css";
import "./lobby.css";
import "./tables.css";

export const metadata: Metadata = {
  title: { template: "%s | House 37", default: "House 37 — Teen Patti & Roulette" },
  description: "Take a seat for a three-card showdown or spin the European roulette wheel. Free play at House 37.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
