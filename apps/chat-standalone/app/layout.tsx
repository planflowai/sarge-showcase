import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SARGE Chat Standalone",
  description: "Standalone Chat — powered by @sarge/chat + @sarge/core",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
