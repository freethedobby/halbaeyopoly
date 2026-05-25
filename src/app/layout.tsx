import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolyAirdrop — $POLY airdrop estimator",
  description: "Estimate your Polymarket $POLY airdrop from your wallet activity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
