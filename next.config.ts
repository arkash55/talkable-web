import type { NextConfig } from "next";

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/',      
        destination: '/home', 
        permanent: true,   
      },
    ]
  },
};

module.exports = nextConfig;

