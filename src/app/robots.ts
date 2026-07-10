import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://everythinglocal.shop").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/onboarding/", "/api/", "/callback"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
