import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Desk — The Foundry",
  description: "Live market intelligence and stock research powered by Tavily + AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
