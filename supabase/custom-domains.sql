-- Custom domains for vendor storefronts (premium feature)
-- Lets a premium vendor point their own domain (e.g. joespizza.com) at their
-- /vendors/[slug] page. Proxy (src/proxy.ts) reads custom_domain to rewrite.

alter table public.vendors
  add column if not exists custom_domain text unique,
  add column if not exists domain_verified boolean not null default false,
  add column if not exists domain_added_at timestamptz;

-- Fast lookup by incoming Host header in the proxy. Only verified, active
-- domains are ever served, so we index the populated rows.
create index if not exists vendors_custom_domain_idx
  on public.vendors (custom_domain)
  where custom_domain is not null;

-- Note: reads are already covered by the existing
-- "Anyone can view active vendors" RLS policy, so the proxy can resolve a
-- domain -> slug with the public anon key. Writes go through the API routes
-- which use the authenticated user's session and the existing
-- "Vendors can update own profile" policy.
