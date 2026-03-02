import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pg', 'pg-pool'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle Node.js modules for the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
      // Alias pg to empty module for browser builds
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
      };
    }
    return config;
  },
};

export default nextConfig;
