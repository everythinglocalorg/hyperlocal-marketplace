import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Food-truck photos hotlinked from their public listings/sites
      { protocol: "https", hostname: "d3gnjjq3mhphne.cloudfront.net" },
      { protocol: "https", hostname: "images.squarespace-cdn.com" },
      { protocol: "https", hostname: "static.wixstatic.com" },
      { protocol: "https", hostname: "infinitybeverages.com" },
    ],
  },
};

export default nextConfig;
