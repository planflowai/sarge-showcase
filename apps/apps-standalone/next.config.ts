import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// Load centralized env vars from monorepo root .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const emptyStub = path.resolve(__dirname, "lib/stubs/empty.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@sarge/core", "@sarge/apps"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Stub out packages that apps-standalone doesn't need.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sarge/builder": emptyStub,
      "@sarge/builder/stores/builderChatStore": emptyStub,
      "@sarge/chat": emptyStub,
      "@sarge/diagnostics": emptyStub,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
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
