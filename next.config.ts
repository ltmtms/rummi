import type { NextConfig } from "next";

// GitHub Pages serves project sites from /<repo-name>; the deploy workflow sets this.
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
