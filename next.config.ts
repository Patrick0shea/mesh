import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@meshtastic/js", "@meshtastic/protobufs"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Point @meshtastic/js to the compiled JS, not the .ts source
    config.resolve.alias = {
      ...config.resolve.alias,
      "@meshtastic/js": path.resolve(
        "./node_modules/@meshtastic/js/dist/index.js"
      ),
    };

    return config;
  },
};

export default nextConfig;
