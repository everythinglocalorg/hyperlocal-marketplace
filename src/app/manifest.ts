import type { MetadataRoute } from "next";

// PWA manifest — makes Everything Local installable to a phone's home screen
// and launch full-screen (no browser chrome).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Everything Local",
    short_name: "Everything Local",
    description:
      "One click searching for every local business, product, and service near you — plus Local Bucks rewards for supporting local.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#00a63e",
    categories: ["shopping", "business", "lifestyle"],
    icons: [
      { src: "/api/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
