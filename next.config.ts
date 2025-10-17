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
            key: 'Permissions-Policy',
            value: 'camera=(); microphone=(); geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' https:; media-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
           {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
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

  experimental: {
    serverActions: {
      allowedOrigins: [
        "https://qr.rsudpasarrebo.id", // domain publik (IIS terminates TLS)
        "http://10.0.10.12:5002",              // origin internal kamu
        "http://localhost:5002",                // dev (opsional)
        "http://127.0.0.1:5002",                // dev (opsional)
      ],
    },
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
