import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'apps.rsudpasarrebo.id',
        port: '',
        pathname: '/img/**',
      },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Hide Next.js version and other sensitive info
  poweredByHeader: false,
  
  // Disable server info in error pages
  generateEtags: false,
  
  // Security: Don't expose internal paths
  trailingSlash: false,
  
  // Compress responses
  compress: true,
};

export default nextConfig;
