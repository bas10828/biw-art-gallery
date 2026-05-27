import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    localPatterns: [{ pathname: "/images/**" }],
  },
};

export default nextConfig;
