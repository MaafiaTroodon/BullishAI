/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  // Disable static optimization for AI pages that use search params
  generateStaticParams: false,
  // Ensure API routes work in production
  async rewrites() {
    return []
  },
}

module.exports = nextConfig

