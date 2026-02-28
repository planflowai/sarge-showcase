import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PinLock } from "@/components/auth/PinLock";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AirGapBlockAlert } from "@/components/layout/AirGapBlockAlert";
import { GlobalToast } from "@/components/layout/GlobalToast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S.A.R.G.E. Chat",
  description: "Synthetic Adversarial Reasoning & Guarding Engine — Chat Standalone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100`}>
        <ThemeProvider>
          <PinLock>
            <div className="flex flex-col h-dvh overflow-hidden">
              {/* Header with S.A.R.G.E. title + navigation */}
              <Header />
              {/* Main content area with optional sidebar */}
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">{children}</main>
              </div>
            </div>
            {/* Air-Gap Block Alert Modal */}
            <AirGapBlockAlert />
            {/* Global Toast Notifications */}
            <GlobalToast />
          </PinLock>
        </ThemeProvider>
      </body>
    </html>
  );
}
