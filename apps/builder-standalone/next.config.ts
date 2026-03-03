import type { NextConfig } from "next";
import path from "path";
import dotenv from "dotenv";

// Load centralized env vars from monorepo root .env.local
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const emptyStub = path.resolve(__dirname, "lib/stubs/empty.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@sarge/core", "@sarge/chat", "@sarge/builder", "@sarge/benchmark", "@sarge/audit"],
  // Keep audit-heavy Node.js packages out of webpack bundling —
  // lighthouse uses import.meta for path resolution, axe-core/jsdom need native Node APIs
  serverExternalPackages: [
    "lighthouse",
    "chrome-launcher",
    "axe-core",
    "jsdom",
    "html-validate",
  ],
  // Turbopack: empty config silences Next.js 16 webpack-only warning.
  // Windows paths not yet supported in Turbopack resolveAlias — use --webpack flag.
  turbopack: {},
  async rewrites() {
    // Catch-all proxy to beast for routes not handled locally.
    // Local routes (in app/api/) take priority over rewrites automatically.
    // Local: chat, test/stream, deploy, models/scan, status, builder/*,
    //        thread-guardian, jury-guardian, search/tavily, image
    // Proxied: diagnostics/*, journal/*, rollcall, health, web-search, etc.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Paths to package store directories
    const coreStores = path.resolve(__dirname, "../../packages/core/src/stores");
    const chatStores = path.resolve(__dirname, "../../packages/chat/src/stores");

    // Stub out packages and stores that builder-standalone doesn't need.
    // These get pulled in via barrel exports but are never used by any builder component.
    // Each stubbed store = one fewer localStorage hydration + JSON.parse on page load.
    config.resolve.alias = {
      ...config.resolve.alias,
      // Full package stub
      "@sarge/diagnostics": emptyStub,
      // Core stores not used by builder (4 persisted stores eliminated)
      [path.join(coreStores, "forensicLogStore")]: emptyStub,
      [path.join(coreStores, "truthAnchorStore")]: emptyStub,
      [path.join(coreStores, "syncStatusStore")]: emptyStub,
      [path.join(coreStores, "journalStore")]: emptyStub,
      // Chat stores not used by builder (1 persisted + 1 non-persisted eliminated)
      [path.join(chatStores, "debateHistoryStore")]: emptyStub,
      [path.join(chatStores, "debateStore")]: emptyStub,
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
