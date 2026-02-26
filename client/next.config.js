/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stakeoption/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
