import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { GlobalToast } from "@/components/layout/GlobalToast";

export const metadata: Metadata = {
  title: "The Foundry",
  description: "The Foundry — AI-powered multi-model code builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 min-h-0">
          {children}
        </main>
        <GlobalToast />
      </body>
    </html>
  );
}
