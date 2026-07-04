import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    // Sandbox preview domains — wildcard matches all subdomains
    "*.space-z.ai",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ],
};

export default nextConfig;
