import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Launch Pad — The Foundry",
  description: "Start and stop all S.A.R.G.E. standalone apps from one dashboard",
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
