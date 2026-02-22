import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
};

// Note: Port 5000 is set via package.json scripts or env var
// For Next.js, use: next dev -p 5000

export default nextConfig;
