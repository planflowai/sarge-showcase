import type { NextConfig } from "next";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../.env.local") });

const nextConfig: NextConfig = {};

export default nextConfig;
