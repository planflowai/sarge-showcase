import type { NextConfig } from "next";
import path from "path";

const emptyStub = path.resolve(__dirname, "lib/stubs/empty.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@sarge/core", "@sarge/chat"],
  webpack: (config, { isServer }) => {
    // Stub out packages that chat-standalone doesn't need.
    // Applied to BOTH client and server builds to prevent transitive resolution.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sarge/builder": emptyStub,
      "@sarge/builder/stores/builderChatStore": emptyStub,
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
