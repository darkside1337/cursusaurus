import type { NextConfig } from "next";
// Validate environment variables on startup / build
import "./config/env";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
};

export default nextConfig;
