const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "~": path.resolve(__dirname, "./"),
    };
    if (!dev) {
      config.devtool = false;
    }
    return config;
  },
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: "bottom-right",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;