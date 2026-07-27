import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile problematic packages
  transpilePackages: ["appwrite"],

  webpack: (config) => {
    // Resolve @/ alias
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.join(__dirname, "src"),
    };

    // Polyfills for Solana wallet adapter
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      os: false,
      fs: false,
      path: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
