import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev and production builds in separate output dirs so `next dev` can
  // never clobber the production build that systemd serves on :3002.
  distDir:
    process.env.NEXT_DIST_DIR ||
    (process.env.NODE_ENV === "development" ? ".next-dev" : ".next"),

  // Reduce peak memory during `next build`. This box is shared with other
  // services and was OOM-ing mid-build (surfacing as a bogus globals.css /
  // css-loader "webpack error"). Disabling dual string buffer caching and
  // interning identical strings significantly lowers webpack's footprint.
  experimental: {
    webpackMemoryOptimizations: true,
  },

  // Skip the tsc type-check during `next build`. This shared box has ~8 GB of
  // swap in use; the type-check step allocates a large type graph, thrashes
  // swap and stalls the build for 10+ minutes (deadlock in ep_poll). Types are
  // still validated manually with `npx tsc --noEmit` (which passes).
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // A deploy replaces every chunk hash. An HTML page that outlives its build
  // then points at scripts that no longer exist, and the page arrives with its
  // client components dead: the blade never renders and the ticker keeps only
  // the lines it was compiled with. Hashed assets are immutable; the document
  // is never cached.
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

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
