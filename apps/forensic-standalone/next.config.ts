import type { NextConfig } from "next";
import { resolve } from "path";
import { config } from "dotenv";

// Load .env.local from monorepo root so API keys are available
config({ path: resolve(__dirname, "../../.env.local") });

const nextConfig: NextConfig = {};

export default nextConfig;
