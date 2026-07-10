"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Area, Addon, estimateCost } from "@/lib/estimate-pricing";

type Row = {
  id: string; title: string; status: string; created_at: string; customer: string | null;
  revenue: number; cost: number; profit: number; margin: number; laborHours: number;
};

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-600",
};
type Filter = "all" | "accepted" | "sent" | "draft";

// Profit view across proposals. Revenue = proposal total; cost = material COGS +
// labor hours × your hourly cost rate; profit = revenue − cost.
export default function JobMetrics({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [costRate, setCostRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vendorId]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: ests }] = await Promise.all([
      supabase.from("estimate_settings").select("hourly_cost_rate").eq("vendor_id", vendorId).maybeSingle(),
      supabase.from("estimates").select("id, title, status, created_at, customer_name, areas, addons").eq("vendor_id", vendorId).order("created_at", { ascending: false }),
    ]);
    const rate = Number(s?.hourly_cost_rate) || 0;
    setCostRate(rate);
    setRows(((ests as any[]) ?? []).map((e) => {
      const areas: Area[] = Array.isArray(e.areas) ? e.areas : [];
      const addons: Addon[] = Array.isArray(e.addons) ? e.addons : [];
      const c = estimateCost(areas, addons, rate);
      return {
        id: e.id, title: e.title, status: e.status, created_at: e.created_at, customer: e.customer_name ?? null,
        revenue: c.revenue, cost: c.cost, profit: c.profit, margin: c.margin, laborHours: c.laborHours,
      };
    }));
    setLoading(false);
  }

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((r) => r.status === filter), [rows, filter]);
  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.revenue, 0);
    const cost = filtered.reduce((s, r) => s + r.cost, 0);
    const profit = revenue - cost;
    const hours = filtered.reduce((s, r) => s + r.laborHours, 0);
    return { revenue, cost, profit, hours, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }, [filtered]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Job Metrics</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Profit per proposal using your hourly cost rate{costRate > 0 ? ` ($${costRate.toFixed(2)}/hr)` : ""}.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["all", "accepted", "sent", "draft"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-colors ${filter === f ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{f}</button>
          ))}
        </div>
      </div>

      {costRate === 0 && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2">
          Set your <strong>Hourly cost rate</strong> in Estimator Tools → Settings for accurate profit. Labor cost is $0 until you do.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Revenue", value: money(totals.revenue), color: "text-gray-900" },
          { label: "Cost", value: money(totals.cost), color: "text-gray-900" },
          { label: "Profit", value: money(totals.profit), color: totals.profit < 0 ? "text-red-600" : "text-green-700" },
          { label: "Margin", value: `${totals.margin.toFixed(1)}%`, color: totals.margin < 0 ? "text-red-600" : "text-green-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold text-gray-600 mb-1">No proposals to measure</p>
          <p className="text-sm">Build proposals and their profit shows up here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="py-2.5 px-4 font-semibold">Proposal</th>
                <th className="py-2.5 px-2 font-semibold text-right">Revenue</th>
                <th className="py-2.5 px-2 font-semibold text-right">Cost</th>
                <th className="py-2.5 px-2 font-semibold text-right">Profit</th>
                <th className="py-2.5 px-2 font-semibold text-right">Margin</th>
                <th className="py-2.5 px-4 font-semibold text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate max-w-[220px]">{r.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? STATUS_COLORS.draft}`}>{r.status}</span>
                    </div>
                    {r.customer && <p className="text-xs text-gray-400">{r.customer}</p>}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-700">{money(r.revenue)}</td>
                  <td className="py-2.5 px-2 text-right text-gray-700">{money(r.cost)}</td>
                  <td className={`py-2.5 px-2 text-right font-semibold ${r.profit < 0 ? "text-red-600" : "text-green-700"}`}>{money(r.profit)}</td>
                  <td className={`py-2.5 px-2 text-right ${r.margin < 0 ? "text-red-600" : "text-gray-700"}`}>{r.margin.toFixed(0)}%</td>
                  <td className="py-2.5 px-4 text-right text-gray-500">{r.laborHours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
