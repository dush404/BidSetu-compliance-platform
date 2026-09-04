import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* keep the bottom-left corner clear for the sidebar profile */
  devIndicators: false,
};

export default nextConfig;
