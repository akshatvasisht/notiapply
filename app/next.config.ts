import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pg', 'pg-pool', 'nodemailer'],

  // Turbopack config (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      // Prevent Node.js-only modules from bundling in browser
      pg: './lib/pg-stub.ts',
      nodemailer: './lib/nodemailer-stub.ts',
      dns: './lib/dns-stub.ts',
      'dns/promises': './lib/dns-stub.ts',
    },
  },

  // Webpack config (for --webpack flag or production builds)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle Node.js modules for the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
      // Alias Node.js-only packages to stubs for browser builds
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
        nodemailer: false,
        'dns/promises': false,
      };
    }
    return config;
  },
};

export default nextConfig;
