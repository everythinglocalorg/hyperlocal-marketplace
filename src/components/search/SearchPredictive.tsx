"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { rememberBackTo } from "@/lib/backNav";

type Hit =
  | { kind: "vendor"; id: string; label: string; href: string; img: string | null; sub: string }
  | { kind: "listing"; id: string; label: string; href: string; img: string | null; sub: string }
  | { kind: "profile"; id: string; label: string; href: string; img: string | null; sub: string };

// Live predictive dropdown for the main search bar: stores, products, and people
// as you type. Navigates straight to a match, or runs a full search via the top
// "Search for …" row. Sits inside any `position: relative` field.
//
// `@`-prefixed queries are handled by AtMentionDropdown, so this stays out of the
// way then. Keeps the existing search behavior intact — it only adds suggestions.
export default function SearchPredictive({ query, onSearchAll, rememberBase }: { query: string; onSearchAll: () => void; rememberBase?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [hits, setHits] = useState<Hit[]>([]);

  // When invoked from the search page, record where to return so the detail
  // page's back arrow lands on these results (e.g. the "pizza" search).
  function go(href: string) {
    if (rememberBase) {
      const url = `${rememberBase}?q=${encodeURIComponent(q)}`;
      rememberBackTo(url); // product page's inside arrow
      // Stamp the current entry so even browser-back lands on these results.
      try { window.history.replaceState(null, "", url); } catch { /* noop */ }
    }
    router.push(href);
  }

  const q = query.trim();
  const active = q.length >= 2 && !q.startsWith("@");

  useEffect(() => {
    if (!active) { setHits([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      const [{ data: vendors }, { data: listings }, { data: people }] = await Promise.all([
        supabase.from("vendors").select("id, business_name, slug, logo_url, category").eq("is_active", true).ilike("business_name", `%${q}%`).limit(4),
        supabase.from("listings").select("id, title, images, price").eq("is_active", true).ilike("title", `%${q}%`).limit(5),
        supabase.from("profiles").select("id, full_name, avatar_url").ilike("full_name", `%${q}%`).not("full_name", "is", null).limit(3),
      ]);
      if (cancel) return;
      const out: Hit[] = [
        ...((vendors ?? []) as any[]).map((v) => ({ kind: "vendor" as const, id: v.id, label: v.business_name, href: `/vendors/${v.slug}`, img: v.logo_url, sub: v.category || "Store" })),
        ...((listings ?? []) as any[]).map((l) => ({ kind: "listing" as const, id: l.id, label: l.title, href: `/listings/${l.id}`, img: (l.images ?? [])[0] ?? null, sub: l.price != null ? `$${Number(l.price).toLocaleString()}` : "Product" })),
        ...((people ?? []) as any[]).map((p) => ({ kind: "profile" as const, id: p.id, label: p.full_name, href: `/u/${p.id}`, img: p.avatar_url, sub: "Person" })),
      ];
      setHits(out);
    }, 180);
    return () => { cancel = true; clearTimeout(t); };
  }, [active, q, supabase]);

  if (!active) return null;

  const groups: { title: string; items: Hit[] }[] = [
    { title: "Stores", items: hits.filter((h) => h.kind === "vendor") },
    { title: "Products", items: hits.filter((h) => h.kind === "listing") },
    { title: "People", items: hits.filter((h) => h.kind === "profile") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-96 overflow-y-auto text-left">
      {/* Run the full search */}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onSearchAll(); }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-green-50 transition-colors border-b border-gray-100"
      >
        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /></svg>
        <span className="text-gray-700">Search for <strong className="text-gray-900">&ldquo;{q}&rdquo;</strong></span>
      </button>

      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{g.title}</p>
          {g.items.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); go(h.href); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors"
            >
              <span className="w-7 h-7 rounded-md bg-green-100 flex items-center justify-center text-xs overflow-hidden shrink-0">
                {h.img ? <img src={h.img} alt="" className="w-full h-full object-cover" /> : (h.kind === "vendor" ? "🏢" : h.kind === "listing" ? "🛍️" : "👤")}
              </span>
              <span className="font-medium text-gray-800 truncate">{h.label}</span>
              <span className="ml-auto text-xs text-gray-400 shrink-0">{h.sub}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
