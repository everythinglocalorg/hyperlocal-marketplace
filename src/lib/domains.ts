// Helpers for routing custom vendor domains, used by the proxy (src/proxy.ts).

// Hosts that belong to the platform itself (not a vendor's custom domain).
// Anything else arriving as a Host header is a candidate custom domain.
export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.startsWith("127.0.0.1")) return true;
  if (host.endsWith(".vercel.app")) return true; // preview + default deploys

  // The primary marketing/app domain from env (e.g. everythinglocal.com).
  try {
    const appHost = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).hostname;
    if (host === appHost) return true;
    // also treat www. of the app domain as platform
    if (host === `www.${appHost}`) return true;
  } catch {
    // ignore malformed env
  }
  return false;
}

// Resolve an incoming Host header to a vendor slug, if a verified custom
// domain is mapped to it. Uses the public anon key + the existing
// "Anyone can view active vendors" RLS policy, so no service role needed.
// Returns null when there is no match.
export async function lookupVendorSlugByDomain(
  host: string
): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  const url =
    `${base}/rest/v1/vendors?select=slug` +
    `&custom_domain=eq.${encodeURIComponent(host)}` +
    `&domain_verified=is.true&is_active=is.true&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { slug: string }[];
    return rows?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}
