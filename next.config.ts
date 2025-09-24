import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  output: "standalone", // For Docker
  productionBrowserSourceMaps: true, // Enable source maps for debugging
  experimental: {
    serverMinification: false, // Disable server minification for debugging
  },
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  async headers() {
    return [
      {
        source: "/widget/menu.json",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Cache-Control", value: "public, max-age=600, immutable" },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  // markdown plugins go here
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
