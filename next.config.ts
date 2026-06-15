import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    // Sandbox preview domains
    ".space-z.ai",
    "localhost",
  ],
};

export default nextConfig;
