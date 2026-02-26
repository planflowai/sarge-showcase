import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SARGE Diagnostics Standalone",
  description: "Standalone Diagnostics — powered by @sarge/diagnostics + @sarge/core",
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
