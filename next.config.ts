import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include public/fonts in the serverless function bundle so fs.readFileSync
  // can find TTF files at runtime on Vercel (public/ is CDN-only by default)
  outputFileTracingIncludes: {
    "/api/certificates/render": ["./public/fonts/**"],
    "/api/templates/preview": ["./public/fonts/**"],
  },
};

export default nextConfig;
