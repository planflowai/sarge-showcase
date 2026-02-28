import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "S.A.R.G.E. Forge",
  description: "S.A.R.G.E. Forge — AI-powered multi-model code builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-zinc-950 text-zinc-100 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
