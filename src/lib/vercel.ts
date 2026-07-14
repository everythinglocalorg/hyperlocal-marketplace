// Vercel Domains API helpers.
//
// When a vendor connects a custom domain we attach it to this Vercel project
// programmatically so we never have to add domains by hand in the dashboard.
// Docs: https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project
//
// Required env (see .env.example):
//   VERCEL_API_TOKEN   - a token from https://vercel.com/account/tokens
//   VERCEL_PROJECT_ID  - this project's ID (Vercel project Settings -> General)
//   VERCEL_TEAM_ID     - only if the project lives under a team (Settings -> General)

const API = "https://api.vercel.com";

const TOKEN = process.env.VERCEL_API_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

export function vercelConfigured(): boolean {
  return Boolean(TOKEN && PROJECT_ID);
}

function teamQuery(extra = ""): string {
  const params = new URLSearchParams();
  if (TEAM_ID) params.set("teamId", TEAM_ID);
  const q = params.toString();
  if (!q) return extra;
  return extra ? `${extra}&${q}` : `?${q}`;
}

async function vercelFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message ?? `Vercel API error (${res.status})`;
    throw new Error(message);
  }
  return body;
}

// Attach a domain to the project. Safe to call again if it already exists.
export async function addDomainToProject(domain: string) {
  return vercelFetch(`/v10/projects/${PROJECT_ID}/domains${teamQuery()}`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

export async function removeDomainFromProject(domain: string) {
  return vercelFetch(
    `/v9/projects/${PROJECT_ID}/domains/${domain}${teamQuery()}`,
    { method: "DELETE" }
  );
}

// The www. form of an apex domain (e.g. "4kegs.com" -> "www.4kegs.com").
// Returns null for subdomains / already-www hosts, which don't need one.
export function wwwVariant(domain: string): string | null {
  return domain.split(".").length === 2 ? `www.${domain}` : null;
}

// Whether Vercel considers the domain verified (DNS + ownership in place).
export async function getDomainStatus(
  domain: string
): Promise<{ verified: boolean; misconfigured: boolean }> {
  const info = await vercelFetch(
    `/v9/projects/${PROJECT_ID}/domains/${domain}${teamQuery()}`
  );
  const config = await vercelFetch(
    `/v6/domains/${domain}/config${teamQuery()}`
  ).catch(() => ({ misconfigured: true }));

  return {
    verified: Boolean(info?.verified),
    misconfigured: Boolean(config?.misconfigured),
  };
}

// Ask Vercel to re-check verification (after the vendor adds DNS records).
export async function verifyDomain(domain: string) {
  return vercelFetch(
    `/v9/projects/${PROJECT_ID}/domains/${domain}/verify${teamQuery()}`,
    { method: "POST" }
  );
}

// The DNS records a vendor must add at their registrar (e.g. GoDaddy).
// Apex domains (joespizza.com) use an A record; subdomains (shop.joespizza.com)
// use a CNAME. These are Vercel's standard targets.
export function dnsInstructionsFor(domain: string) {
  const isApex = domain.split(".").length === 2;
  if (isApex) {
    return {
      type: "A" as const,
      name: "@",
      value: "76.76.21.21",
    };
  }
  const sub = domain.split(".")[0];
  return {
    type: "CNAME" as const,
    name: sub,
    value: "cname.vercel-dns.com",
  };
}
