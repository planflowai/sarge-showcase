import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Debate Arena — The Foundry",
  description: "AI Tribunal — Multi-Agent Fact Verification System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('debate-theme');
                if (theme === 'light') document.documentElement.classList.remove('dark');
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  );
}
