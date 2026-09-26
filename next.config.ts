import type { NextConfig } from "next";

// Game routes were removed; send old (possibly indexed/shared) links home.
const REMOVED_ROUTES = ["/game", "/leaderboard", "/bomberman"];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    localPatterns: [{ pathname: "/images/**" }],
  },
  async redirects() {
    return REMOVED_ROUTES.flatMap((route) => [
      { source: route, destination: "/", permanent: true },
      { source: `${route}/:path*`, destination: "/", permanent: true },
      { source: `/en${route}`, destination: "/en", permanent: true },
      { source: `/en${route}/:path*`, destination: "/en", permanent: true },
    ]);
  },
};

export default nextConfig;
