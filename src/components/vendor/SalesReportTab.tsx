"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// A cross-channel sales report: unifies food orders, product purchases, and
// bookings/rentals into one view with headline stats, revenue-over-time, top
// sellers, and a channel breakdown. All reads are RLS-scoped to the vendor.

type Sale = { date: string; amount: number; channel: string };
type SoldItem = { title: string; qty: number; revenue: number };
type Chan = { channel: string; count: number; revenue: number };

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CHAN_COLOR: Record<string, string> = {
  "Food orders": "bg-green-500",
  "Products": "bg-blue-500",
  "Bookings": "bg-amber-500",
};

export default function SalesReportTab({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SoldItem[]>([]);

  function bounds() {
    const now = new Date();
    let to = now;
    let from: Date;
    if (range === "7d") from = new Date(Date.now() - 6 * 864e5);
    else if (range === "90d") from = new Date(Date.now() - 89 * 864e5);
    else if (range === "custom") {
      from = customFrom ? new Date(customFrom + "T00:00:00") : new Date(Date.now() - 29 * 864e5);
      to = customTo ? new Date(customTo + "T23:59:59") : now;
    } else from = new Date(Date.now() - 29 * 864e5);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = bounds();
    const f = from.toISOString();
    const t = to.toISOString();
    const [food, buys, rentals] = await Promise.all([
      supabase.from("food_orders").select("total, created_at, items, status").eq("vendor_id", vendorId).neq("status", "cancelled").gte("created_at", f).lte("created_at", t).limit(5000),
      supabase.from("purchase_inquiries").select("created_at, inquiry_type, listing:listings(title, price)").eq("vendor_id", vendorId).eq("inquiry_type", "buy").gte("created_at", f).lte("created_at", t).limit(5000),
      supabase.from("rental_bookings").select("total_price, created_at, status, listing:listings(title)").eq("vendor_id", vendorId).neq("status", "cancelled").gte("created_at", f).lte("created_at", t).limit(5000),
    ]);

    const s: Sale[] = [];
    const map = new Map<string, SoldItem>();
    const add = (title: string, qty: number, revenue: number) => {
      const k = (title || "Item").trim();
      const cur = map.get(k) ?? { title: k, qty: 0, revenue: 0 };
      cur.qty += qty; cur.revenue += revenue; map.set(k, cur);
    };

    for (const o of (food.data ?? []) as { total: number; created_at: string; items: unknown }[]) {
      s.push({ date: o.created_at, amount: Number(o.total) || 0, channel: "Food orders" });
      const line = Array.isArray(o.items) ? o.items : [];
      for (const it of line as { title?: string; qty?: number; price?: number }[]) {
        add(it.title ?? "Item", Number(it.qty) || 0, (Number(it.price) || 0) * (Number(it.qty) || 0));
      }
    }
    for (const q of (buys.data ?? []) as { created_at: string; listing: unknown }[]) {
      const l = (Array.isArray(q.listing) ? q.listing[0] : q.listing) as { title?: string; price?: number } | null;
      const price = Number(l?.price) || 0;
      s.push({ date: q.created_at, amount: price, channel: "Products" });
      add(l?.title ?? "Product", 1, price);
    }
    for (const b of (rentals.data ?? []) as { total_price: number; created_at: string; listing: unknown }[]) {
      const l = (Array.isArray(b.listing) ? b.listing[0] : b.listing) as { title?: string } | null;
      const amt = Number(b.total_price) || 0;
      s.push({ date: b.created_at, amount: amt, channel: "Bookings" });
      add(l?.title ?? "Booking", 1, amt);
    }

    setSales(s);
    setItems([...map.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, supabase, range, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const revenue = sales.reduce((a, s) => a + s.amount, 0);
  const count = sales.length;
  const avg = count ? revenue / count : 0;

  const perDay = (() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const d = new Date(s.date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      m.set(k, (m.get(k) ?? 0) + s.amount);
    }
    const { from, to } = bounds();
    const days: { label: string; val: number }[] = [];
    const cur = new Date(from); cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    let g = 0;
    while (cur <= end && g < 400) {
      days.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}`, val: m.get(`${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`) ?? 0 });
      cur.setDate(cur.getDate() + 1); g++;
    }
    return days;
  })();
  const maxDay = Math.max(1, ...perDay.map((d) => d.val));

  const channels: Chan[] = (() => {
    const m = new Map<string, { count: number; revenue: number }>();
    for (const s of sales) {
      const c = m.get(s.channel) ?? { count: 0, revenue: 0 };
      c.count++; c.revenue += s.amount; m.set(s.channel, c);
    }
    return [...m.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.revenue - a.revenue);
  })();

  const topItems = items.slice(0, 8);
  const maxItemQty = Math.max(1, ...topItems.map((i) => i.qty));

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-gray-900 mb-1">📈 Reports</h2>
      <p className="text-sm text-gray-500 mb-6">Your sales across every channel — food orders, products, and bookings — in one place.</p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["7d", "30d", "90d", "custom"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${range === r ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            {r === "7d" ? "7 days" : r === "30d" ? "30 days" : r === "90d" ? "90 days" : "Custom"}
          </button>
        ))}
        {range === "custom" && (
          <span className="flex items-center gap-1.5">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs" />
            <span className="text-gray-400 text-xs">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">Revenue</p>
              <p className="text-2xl font-black text-gray-900">{money(revenue)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">Sales</p>
              <p className="text-2xl font-black text-gray-900">{count}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">Avg sale</p>
              <p className="text-2xl font-black text-gray-900">{money(avg)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
            <p className="text-xs font-semibold text-gray-500 mb-3">Revenue over time</p>
            {perDay.every((d) => d.val === 0) ? (
              <p className="text-sm text-gray-400 py-8 text-center">No sales in this range yet.</p>
            ) : (
              <div className="flex items-end gap-1 overflow-x-auto pb-1">
                {perDay.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-4 bg-green-500 rounded-t" style={{ height: Math.max(3, Math.round((d.val / maxDay) * 110)) }} title={`${d.label}: ${money(d.val)}`} />
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{d.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">Top sellers</p>
              {topItems.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No sales yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {topItems.map((it) => (
                    <div key={it.title}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-800 truncate pr-2">{it.title}</span>
                        <span className="text-gray-500 shrink-0">{it.qty} sold · {money(it.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(it.qty / maxItemQty) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">By channel</p>
              {channels.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No sales yet.</p>
              ) : (
                <div className="space-y-3">
                  {channels.map((c) => (
                    <div key={c.channel} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-gray-700">
                        <span className={`w-2.5 h-2.5 rounded-full ${CHAN_COLOR[c.channel] ?? "bg-gray-400"}`} />
                        {c.channel}
                      </span>
                      <span className="text-sm text-gray-500">{c.count} · <span className="font-semibold text-gray-800">{money(c.revenue)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
