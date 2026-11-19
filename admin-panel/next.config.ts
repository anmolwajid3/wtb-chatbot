import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the slim production Docker image on Fly.io.
  output: "standalone",
};

export default nextConfig;
