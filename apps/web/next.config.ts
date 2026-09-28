import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@commitpass/shared"],
  webpack(config) {
    // CommitPass uses EVM only; Privy's optional Farcaster Solana connector is unused.
    config.resolve.alias["@farcaster/mini-app-solana"] = false;
    return config;
  },
};

export default nextConfig;
