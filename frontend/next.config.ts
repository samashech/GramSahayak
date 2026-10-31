import type { NextConfig } from "next";

// LAN / phone testing (scripts/start-demo.sh --lan): the browser talks only to this Next server,
// which proxies /api/* to the Node gateway on the same laptop. The phone never needs port 5000,
// there is no cross-origin request, and HTTPS (needed for the microphone) covers the API too.
const GATEWAY = process.env.GS_GATEWAY_INTERNAL || "http://127.0.0.1:5000";
const lanHosts = (process.env.GS_LAN_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  images: {
    // Serve modern, lightweight formats to save mobile data.
    formats: ["image/avif", "image/webp"],
  },
  // Next 15 blocks dev resources (HMR, chunks) requested from another host unless listed.
  allowedDevOrigins: lanHosts,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${GATEWAY}/api/:path*` }];
  },
};

export default nextConfig;
