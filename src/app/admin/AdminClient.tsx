"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALL_FEATURES, FeatureKey, allFeaturesOn, allFeaturesOff } from "@/lib/features";

type AdminTab = "vendors" | "users" | "listings" | "logs" | "security";

type Vendor = {
  id: string; business_name: string; slug: string; tier: string;
  city: string; state: string; category: string; is_verified: boolean;
  features: Record<string, boolean> | null;
  user_id: string | null;
  is_claimed: boolean;
  claimed_at: string | null;
  owner_name: string | null;
  owner_email: string | null;
};
type UserRow = { id: string; email: string; full_name: string | null; is_admin: boolean; created_at: string };
type Listing = { id: string; title: string; vendor_id: string; is_active: boolean; price: number | null; vendor?: { business_name: string } | null };
type LogRow = { id: string; action: string; target_type: string | null; detail: string | null; created_at: string };
type SpamFlag = { id: string; type: string; status: string; details: Record<string, any>; created_at: string; flagged_user_id: string | null };

interface Props { adminId: string; }

export default function AdminClient({ adminId }: Props) {
  const supabase = createClient();
  const [tab, setTab] = useState<AdminTab>("vendors");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Super Admin</h1>
            <p className="text-xs text-gray-400">Everything Local</p>
          </div>
        </div>
        <a href="/dashboard/vendor" className="text-sm text-gray-500 hover:text-green-600 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-green-50 transition-colors">← Vendor Dashboard</a>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tab nav */}
        <div className="flex gap-2 mb-6">
          {([
            { id: "vendors", label: "🏪 Vendors" },
            { id: "users", label: "👤 Users" },
            { id: "listings", label: "📦 Listings" },
            { id: "security", label: "🚨 Security" },
            { id: "logs", label: "📋 Activity Log" },
          ] as { id: AdminTab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.id ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "vendors" && <VendorsTab adminId={adminId} />}
        {tab === "users" && <UsersTab adminId={adminId} />}
        {tab === "listings" && <ListingsTab adminId={adminId} />}
        {tab === "security" && <SecurityTab adminId={adminId} />}
        {tab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}

/* ─── VENDORS TAB ─────────────────────────────────────────────────── */
function VendorsTab({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("vendors")
      .select("id,business_name,slug,tier,city,state,category,is_verified,features,user_id,is_claimed,claimed_at")
      .order("business_name");
    const rows = (data ?? []) as any[];

    // Look up the owner (name + email) for every claimed vendor so admins can
    // verify the right person took over the store.
    const ownerIds = Array.from(new Set(rows.filter((v) => v.user_id).map((v) => v.user_id)));
    const ownerMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ownerIds);
      (owners ?? []).forEach((o: any) => ownerMap.set(o.id, { full_name: o.full_name, email: o.email }));
    }

    setVendors(rows.map((v) => ({
      ...v,
      features: v.features ?? {},
      owner_name: v.user_id ? ownerMap.get(v.user_id)?.full_name ?? null : null,
      owner_email: v.user_id ? ownerMap.get(v.user_id)?.email ?? null : null,
    })));
    setLoading(false);
  }

  async function log(action: string, target_id: string, detail: string) {
    await supabase.from("admin_logs").insert({ admin_id: adminId, action, target_type: "vendor", target_id, detail });
  }

  async function toggleFeature(vendor: Vendor, key: FeatureKey, value: boolean) {
    const newFeatures = { ...(vendor.features ?? {}), [key]: value };
    setSaving(true);
    await supabase.from("vendors").update({ features: newFeatures }).eq("id", vendor.id);
    await log(`feature_${value ? "on" : "off"}`, vendor.id, `${key} → ${value}`);
    setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, features: newFeatures } : v));
    if (selected?.id === vendor.id) setSelected({ ...vendor, features: newFeatures });
    setSaving(false);
  }

  async function changeTier(vendor: Vendor, newTier: "free" | "premium") {
    const features = newTier === "premium" ? allFeaturesOn() : allFeaturesOff();
    setSaving(true);
    await supabase.from("vendors").update({ tier: newTier, features }).eq("id", vendor.id);
    await log(newTier === "premium" ? "grant_local_pro" : "revoke_local_pro", vendor.id, vendor.business_name);
    setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, tier: newTier, features } : v));
    if (selected?.id === vendor.id) setSelected({ ...vendor, tier: newTier, features });
    setSaving(false);
  }

  async function toggleVerified(vendor: Vendor) {
    const newVal = !vendor.is_verified;
    await supabase.from("vendors").update({ is_verified: newVal }).eq("id", vendor.id);
    await log(newVal ? "verify" : "unverify", vendor.id, vendor.business_name);
    setVendors((prev) => prev.map((v) => v.id === vendor.id ? { ...v, is_verified: newVal } : v));
    if (selected?.id === vendor.id) setSelected({ ...vendor, is_verified: newVal });
  }

  const s = search.toLowerCase();
  const filtered = vendors.filter((v) =>
    !search || v.business_name.toLowerCase().includes(s) ||
    v.city.toLowerCase().includes(s) ||
    v.category.toLowerCase().includes(s) ||
    (v.owner_email?.toLowerCase().includes(s) ?? false) ||
    (v.owner_name?.toLowerCase().includes(s) ?? false)
  );

  return (
    <div className="flex gap-6">
      {/* List */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors, city, category..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((v) => (
              <div
                key={v.id}
                className={`w-full bg-white border rounded-xl px-4 py-3 hover:shadow-sm transition-all ${selected?.id === v.id ? "border-green-400 ring-1 ring-green-400" : "border-gray-100"}`}
              >
                <div className="flex items-center gap-3">
                  <button className="flex-1 min-w-0 text-left" onClick={() => setSelected(v)}>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{v.business_name}</p>
                      {v.is_verified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>}
                      {v.is_claimed
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Claimed</span>
                        : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⏳ Unclaimed</span>}
                    </div>
                    <p className="text-xs text-gray-400">{v.category} · {v.city}, {v.state}</p>
                    {v.is_claimed && v.owner_email && (
                      <p className="text-xs text-green-700 mt-0.5 truncate">👤 {v.owner_email}</p>
                    )}
                  </button>
                  <select
                    value={v.tier === "premium" ? "premium" : "free"}
                    onChange={(e) => changeTier(v, e.target.value as "free" | "premium")}
                    disabled={saving}
                    className={`text-xs font-semibold border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40 cursor-pointer ${v.tier === "premium" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}
                  >
                    <option value="free">Free</option>
                    <option value="premium">⭐ Local Pro</option>
                  </select>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No vendors found</p>}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 shrink-0">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sticky top-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">{selected.business_name}</h2>
                <p className="text-xs text-gray-400">{selected.city}, {selected.state}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500">✕</button>
            </div>

            {/* Owner / claim verification */}
            <div className={`mb-5 rounded-xl p-3 ${selected.is_claimed ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ownership</p>
              {selected.is_claimed ? (
                <>
                  <p className="text-sm font-semibold text-green-800">✓ Claimed</p>
                  <div className="mt-1.5 space-y-0.5 text-sm">
                    <p className="text-gray-700"><span className="text-gray-400">Owner:</span> {selected.owner_name || "—"}</p>
                    <p className="text-gray-700 break-all">
                      <span className="text-gray-400">Email:</span>{" "}
                      {selected.owner_email
                        ? <a href={`mailto:${selected.owner_email}`} className="text-green-700 hover:underline">{selected.owner_email}</a>
                        : "—"}
                    </p>
                    {selected.claimed_at && (
                      <p className="text-gray-500 text-xs">Claimed {new Date(selected.claimed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Verify this email matches the real business before approving Local Pro or changes.</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-amber-800">⏳ Unclaimed placeholder — no owner account yet.</p>
              )}
            </div>

            {/* Tier control */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Membership</p>
              <select
                value={selected.tier === "premium" ? "premium" : "free"}
                onChange={(e) => changeTier(selected, e.target.value as "free" | "premium")}
                disabled={saving}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-40 cursor-pointer bg-white"
              >
                <option value="free">Free</option>
                <option value="premium">⭐ Local Pro</option>
              </select>
              {saving && <p className="text-xs text-gray-400 mt-1">Saving...</p>}
            </div>

            {/* Individual features */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Features</p>
              <div className="space-y-2">
                {ALL_FEATURES.map((f) => {
                  const on = selected.features?.[f.key] === true;
                  return (
                    <div key={f.key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{f.icon} {f.label}</span>
                      <button
                        onClick={() => toggleFeature(selected, f.key, !on)}
                        disabled={saving}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-green-500" : "bg-gray-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${on ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verified toggle */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">✓ Verified Vendor</span>
                <button
                  onClick={() => toggleVerified(selected)}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${selected.is_verified ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${selected.is_verified ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── USERS TAB ───────────────────────────────────────────────────── */
function UsersTab({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id,email,full_name,is_admin,created_at").order("created_at", { ascending: false })
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });
  }, []);

  async function log(action: string, target_id: string, detail: string) {
    await supabase.from("admin_logs").insert({ admin_id: adminId, action, target_type: "user", target_id, detail });
  }

  async function toggleAdmin(user: UserRow) {
    if (user.id === adminId) return; // can't remove yourself
    const newVal = !user.is_admin;
    await supabase.from("profiles").update({ is_admin: newVal }).eq("id", user.id);
    await log(newVal ? "grant_admin" : "revoke_admin", user.id, user.email);
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_admin: newVal } : u));
  }

  const filtered = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{u.full_name || "—"}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={u.id === adminId}
                      title={u.id === adminId ? "Cannot remove your own admin" : ""}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${u.is_admin ? "bg-green-500" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${u.is_admin ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No users found</p>}
        </div>
      )}
    </div>
  );
}

/* ─── LISTINGS TAB ────────────────────────────────────────────────── */
function ListingsTab({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("listings")
      .select("id,title,vendor_id,is_active,price,vendor:vendors(business_name)")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setListings((data ?? []).map((l: any) => ({ ...l, vendor: Array.isArray(l.vendor) ? l.vendor[0] : l.vendor })));
        setLoading(false);
      });
  }, []);

  async function toggleListing(listing: Listing) {
    const newVal = !listing.is_active;
    await supabase.from("listings").update({ is_active: newVal }).eq("id", listing.id);
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: newVal ? "listing_activate" : "listing_deactivate", target_type: "listing", target_id: listing.id, detail: listing.title });
    setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, is_active: newVal } : l));
  }

  async function deleteListing(listing: Listing) {
    if (!confirm(`Delete "${listing.title}"? This cannot be undone.`)) return;
    await supabase.from("listings").delete().eq("id", listing.id);
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: "listing_delete", target_type: "listing", target_id: listing.id, detail: listing.title });
    setListings((prev) => prev.filter((l) => l.id !== listing.id));
  }

  const filtered = listings.filter((l) =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.vendor?.business_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listings or vendor..."
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Listing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!l.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{l.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{l.vendor?.business_name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.price != null ? `$${l.price}` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleListing(l)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${l.is_active ? "bg-green-500" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${l.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteListing(l)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No listings found</p>}
        </div>
      )}
    </div>
  );
}

/* ─── LOGS TAB ────────────────────────────────────────────────────── */
function LogsTab() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("admin_logs").select("id,action,target_type,detail,created_at").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, []);

  const ACTION_LABELS: Record<string, string> = {
    grant_local_pro: "⭐ Granted Local Pro",
    revoke_local_pro: "❌ Revoked Local Pro",
    feature_on: "✅ Feature enabled",
    feature_off: "🔒 Feature disabled",
    verify: "✓ Verified vendor",
    unverify: "✗ Unverified vendor",
    grant_admin: "👑 Granted admin",
    revoke_admin: "🚫 Revoked admin",
    listing_activate: "📦 Activated listing",
    listing_deactivate: "⏸ Deactivated listing",
    listing_delete: "🗑 Deleted listing",
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No activity yet</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detail</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{ACTION_LABELS[l.action] ?? l.action}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{l.detail ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-400 capitalize">{l.target_type ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── SECURITY TAB ────────────────────────────────────────────────── */
function SecurityTab({ adminId }: { adminId: string }) {
  const supabase = createClient();
  const [flags, setFlags] = useState<SpamFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("spam_flags").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "open") q = q.eq("status", "open");
    const { data } = await q;
    setFlags((data ?? []) as SpamFlag[]);
    setLoading(false);
  }

  async function updateFlag(id: string, status: "dismissed" | "warned") {
    await supabase.from("spam_flags").update({ status, reviewed_at: new Date().toISOString(), reviewed_by: adminId }).eq("id", id);
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: `flag_${status}`, target_type: "spam_flag", target_id: id, detail: status });
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, status } : f));
  }

  const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    message_duplicate: { label: "Duplicate Message", color: "bg-red-100 text-red-700", icon: "💬" },
    listing_duplicate: { label: "Duplicate Listing", color: "bg-orange-100 text-orange-700", icon: "📦" },
  };

  const STATUS_COLOR: Record<string, string> = {
    open: "bg-red-100 text-red-600",
    dismissed: "bg-gray-100 text-gray-500",
    warned: "bg-amber-100 text-amber-700",
  };

  const openCount = flags.filter((f) => f.status === "open").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-900 text-lg">🚨 Security Flags</h2>
          {openCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{openCount} open</span>
          )}
        </div>
        <div className="flex gap-2">
          {(["open", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-xl font-semibold transition-colors ${filter === f ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : flags.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-gray-600">No {filter === "open" ? "open " : ""}flags</p>
          <p className="text-sm">Everything looks clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const meta = TYPE_LABELS[flag.type] ?? { label: flag.type, color: "bg-gray-100 text-gray-600", icon: "⚠️" };
            const d = flag.details ?? {};
            return (
              <div key={flag.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[flag.status]}`}>{flag.status}</span>
                      <span className="text-xs text-gray-400">{new Date(flag.created_at).toLocaleString()}</span>
                    </div>

                    {/* User info */}
                    <p className="text-sm font-semibold text-gray-900">
                      {d.sender_name ?? d.business_name ?? "Unknown user"}
                      {d.sender_email && <span className="text-gray-400 font-normal ml-2">{d.sender_email}</span>}
                    </p>

                    {/* Detail */}
                    {d.message_preview && (
                      <p className="text-sm text-gray-500 mt-1 italic bg-gray-50 rounded-lg px-3 py-2">
                        "{d.message_preview}"
                        {d.duplicate_type && (
                          <span className="ml-2 text-xs text-red-500 not-italic font-semibold">
                            {d.duplicate_type === "cross_vendor" ? "· sent to multiple vendors" : "· repeated in same chat"}
                          </span>
                        )}
                      </p>
                    )}
                    {d.title && (
                      <p className="text-sm text-gray-500 mt-1 italic bg-gray-50 rounded-lg px-3 py-2">
                        Listing: "{d.title}"
                        {d.business_name && <span className="ml-2 text-xs text-gray-400 not-italic">by {d.business_name}</span>}
                      </p>
                    )}
                  </div>

                  {flag.status === "open" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => updateFlag(flag.id, "warned")}
                        className="text-xs bg-amber-100 text-amber-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                        Warn User
                      </button>
                      <button onClick={() => updateFlag(flag.id, "dismissed")}
                        className="text-xs bg-gray-100 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
