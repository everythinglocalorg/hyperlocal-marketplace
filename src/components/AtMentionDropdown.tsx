"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Res = { type: "profile" | "vendor"; id: string; label: string; href: string; img: string | null };

// Drop inside any `position: relative` search field. When the value starts
// with "@", shows matching people + businesses and navigates on click.
export default function AtMentionDropdown({ query }: { query: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [results, setResults] = useState<Res[]>([]);

  const isAt = query.trimStart().startsWith("@");
  const q = isAt ? query.trim().slice(1).trim() : "";

  useEffect(() => {
    if (!isAt || q.length < 1) { setResults([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      const [{ data: people }, { data: biz }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").ilike("full_name", `%${q}%`).not("full_name", "is", null).limit(5),
        supabase.from("vendors").select("id, business_name, slug, logo_url").eq("is_active", true).ilike("business_name", `%${q}%`).limit(5),
      ]);
      if (cancel) return;
      setResults([
        ...((people ?? []) as any[]).map((p) => ({ type: "profile" as const, id: p.id, label: p.full_name as string, href: `/u/${p.id}`, img: p.avatar_url })),
        ...((biz ?? []) as any[]).map((v) => ({ type: "vendor" as const, id: v.id, label: v.business_name as string, href: `/vendors/${v.slug}`, img: v.logo_url })),
      ]);
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [isAt, q, supabase]);

  if (!isAt || results.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto text-left">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Jump to a person or business</p>
      {results.map((r) => (
        <button
          key={`${r.type}-${r.id}`}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); router.push(r.href); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors"
        >
          <span className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center text-xs overflow-hidden shrink-0">
            {r.img ? <img src={r.img} alt="" className="w-full h-full object-cover" /> : (r.type === "vendor" ? "🏢" : "👤")}
          </span>
          <span className="font-medium text-gray-800 truncate">{r.label}</span>
          <span className="ml-auto text-xs text-gray-400 shrink-0">{r.type === "vendor" ? "Business" : "Person"}</span>
        </button>
      ))}
    </div>
  );
}
