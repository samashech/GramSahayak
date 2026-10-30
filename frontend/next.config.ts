import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve modern, lightweight formats to save mobile data.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
