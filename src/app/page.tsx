import { createClient } from "@supabase/supabase-js";
import HomeClient from "./HomeClient";

// Revalidate the seed content periodically; the client island still
// re-personalizes to the visitor's saved city on mount. We use a cookieless
// anon client (seed data is all public) so this page stays statically
// cacheable (ISR) — reading auth cookies here would force dynamic rendering
// and make every homepage hit run the server + Supabase live.
export const revalidate = 300;

// Explicit canonical for the homepage (resolved against metadataBase = .org).
export const metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: blog }, { data: listings }, { data: vendors }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("slug, title, excerpt, cover_image_url, category, author_name, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("listings")
      .select("id, title, price, price_label, images, type, vendor:vendors(business_name, slug, city, state, latitude, longitude)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("vendors")
      .select("id, business_name, slug, logo_url, category, city, state, rating")
      .eq("is_active", true)
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const seedListings = (listings ?? []).filter(
    (l: any) => (Array.isArray(l.vendor) ? l.vendor[0] : l.vendor)?.slug
  );

  // Brand structured data: identifies Everything Local as an organization and
  // enables a Google sitelinks search box pointing at /search.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://everythinglocal.org/#organization",
        name: "Everything Local",
        url: "https://everythinglocal.org",
        logo: "https://everythinglocal.org/icon.svg",
        description:
          "The community-driven hyper-local marketplace — discover local businesses, products, services, rentals, and events, and support your town.",
      },
      {
        "@type": "WebSite",
        "@id": "https://everythinglocal.org/#website",
        url: "https://everythinglocal.org",
        name: "Everything Local",
        publisher: { "@id": "https://everythinglocal.org/#organization" },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://everythinglocal.org/search?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient
        initialListings={seedListings}
        initialVendors={vendors ?? []}
        initialBlog={blog ?? []}
      />
    </>
  );
}
