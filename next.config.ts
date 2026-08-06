import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
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
