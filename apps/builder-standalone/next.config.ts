import type { NextConfig } from "next";
import path from "path";

const emptyStub = path.resolve(__dirname, "lib/stubs/empty.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@sarge/core", "@sarge/chat", "@sarge/builder"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Stub out packages that builder-standalone doesn't need.
    // @sarge/diagnostics gets pulled in transitively via forensic components.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sarge/diagnostics": emptyStub,
    };
    if (!isServer) {
      // Prevent Node.js modules from being bundled client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
      // Handle node: protocol URIs (e.g., pptxgenjs imports node:fs)
      config.plugins.push(
        new (require("webpack")).NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          }
        )
      );
    }
    return config;
  },
};

export default nextConfig;
