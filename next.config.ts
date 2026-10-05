import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  
  typescript: { ignoreBuildErrors: true },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js 16 removed the top-level `eslint` key from next.config.
  // ESLint during build is now controlled via `next lint` and the
  // CLI flag `--no-lint` (passed by the build script when needed).
  reactStrictMode: false,
  // pdfkit + qrcode need to be resolved from node_modules at runtime
  // (pdfkit loads .afm font data files relative to its module path, which
  // Turbopack breaks if bundled). Keeping them external fixes the
  // "ENOENT: no such file or directory, open Helvetica.afm" error.
  serverExternalPackages: ['pdfkit', 'qrcode', 'xlsx'],
  allowedDevOrigins: [
    // Sandbox preview domains — wildcard matches all subdomains
    "*.space-z.ai",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ],
  // ─── Memory stabilization for low-RAM sandbox ─────────────────────────────
  // Disable source maps in dev to cut Turbopack memory use roughly in half.
  // The app is huge (Firebase + 50+ Radix components + recharts + framer-motion)
  // and the sandbox has tight memory; source maps were the main OOM driver.
  productionBrowserSourceMaps: false,
  // ─── Build memory optimization ────────────────────────────────────────────
  // The "Collecting page data" phase loads every page module to determine
  // static optimization. With 200+ API routes + Firebase deps, this peaks at
  // 3GB+ on a 3.9GB sandbox. Disabling worker threads keeps it on the main
  // thread with lower peak memory.
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  // ─── Webpack dev memory tuning (prevents OOM on the 4GB sandbox) ──────────
  // The dev compile graph is enormous (3000+ modules). These flags keep
  // webpack's in-memory caches bounded so the next-server process stays under
  // its --max-old-space-size budget.
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable the persistent filesystem cache in dev — it causes large
      // gz pack files in .next/dev/cache and the rename-ENOENT errors that
      // crash compile-on-demand. In-memory caching is enough for dev.
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;




