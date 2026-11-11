import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md when `next dev` is run by an AI coding tool.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
