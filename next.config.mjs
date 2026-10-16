import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Auto-load .env.v2.local if present
if (fs.existsSync(".env.v2.local")) {
  dotenv.config({ path: ".env.v2.local", override: false });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    AUDIT_ANCHOR_ADDRESS_MAINNET: process.env.AUDIT_ANCHOR_ADDRESS_MAINNET || "",
    AUDIT_ANCHOR_ADDRESS_TESTNET: process.env.AUDIT_ANCHOR_ADDRESS_TESTNET || "",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://arc.network https://*.arc.network https://arc.io https://*.arc.io https://arcscan.app https://*.arcscan.app https://circle.com https://*.circle.com https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
