import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jury Duty — The Foundry",
  description: "Jury Duty — multi-chat quality monitoring and shared context ledger dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=JSON.parse(localStorage.getItem('settings-store')||'{}');var d=(t&&t.state&&t.state.theme)||'dark';document.documentElement.classList.toggle('dark',d==='dark')}catch(e){document.documentElement.classList.add('dark')}})()` }} />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
