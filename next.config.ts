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
};

export default nextConfig;
