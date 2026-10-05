"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { CATEGORIES } from "@/types";
import { makeSlug, normalizeState } from "@/lib/cities";
import { defaultCtaForListingType } from "@/lib/cta";
import Logo from "@/components/Logo";

// Adaptive "create a listing" flow for ANY logged-in user (no business account
// needed — a lightweight personal seller profile is created on first post). ONE
// template, with a Type selector that shows only the fields each type needs.
// Product ("Sell Something") and Food (Food Truck / Restaurant) have their own
// flows and are intentionally NOT here.

type TypeKey = "service" | "event" | "thrift" | "housing_sale" | "rental" | "housing_rent";

const TYPES: {
  value: TypeKey; label: string; cat: string; priceLabel: string;
  titleLabel: string; titlePlaceholder: string;
  condition?: boolean; pickup?: boolean; event?: boolean; housing?: boolean; available?: boolean;
}[] = [
  { value: "service", label: "Service", cat: "Services & Trades", priceLabel: "Starting price (optional)", titleLabel: "Service name", titlePlaceholder: "e.g. Lawn mowing, House cleaning" },
  { value: "event", label: "Event", cat: "Events & Rentals", priceLabel: "Ticket price (blank = free)", titleLabel: "Event name", titlePlaceholder: "e.g. Summer Night Market", event: true },
  { value: "thrift", label: "Thrift Sale", cat: "Thrift Sales", priceLabel: "Price", titleLabel: "What are you selling?", titlePlaceholder: "e.g. Vintage oak dresser", condition: true, pickup: true },
  { value: "housing_sale", label: "House for Sale", cat: "Housing & Rentals", priceLabel: "Price", titleLabel: "Listing title", titlePlaceholder: "e.g. 3 bed ranch on Oak St", housing: true },
  { value: "rental", label: "Rental", cat: "Events & Rentals", priceLabel: "Rental price", titleLabel: "What are you renting out?", titlePlaceholder: "e.g. Kayak, Party tent", pickup: true },
  { value: "housing_rent", label: "Housing (For Rent)", cat: "Housing & Rentals", priceLabel: "Monthly rent", titleLabel: "Listing title", titlePlaceholder: "e.g. 2 bed apartment downtown", housing: true, available: true },
];

function metaFor(t: TypeKey) { return TYPES.find((x) => x.value === t) ?? TYPES[0]; }

export default function ListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingVendor, setExistingVendor] = useState<{ id: string; slug: string; business_name: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; city: string | null; state: string | null } | null>(null);

  const [type, setType] = useState<TypeKey>("service");
  const [sellerName, setSellerName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("Services & Trades");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [condition, setCondition] = useState<"used" | "new">("used");
  const [pickup, setPickup] = useState(true);
  const [event, setEvent] = useState({ date: "", start_time: "", end_time: "", location: "" });
  const [housing, setHousing] = useState({ address: "", bedrooms: "", bathrooms: "", sqft: "", available_date: "" });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = metaFor(type);

  useEffect(() => {
    (async () => {
      let initial: TypeKey = "service";
      try {
        const t = new URLSearchParams(window.location.search).get("type") as TypeKey | null;
        if (t && TYPES.some((x) => x.value === t)) initial = t;
      } catch { /* noop */ }
      setType(initial);
      setCategory(metaFor(initial).cat);
      if (initial === "thrift") setCondition("used");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/login?next=${encodeURIComponent("/list" + (typeof window !== "undefined" ? window.location.search : ""))}`); return; }
      setUserId(user.id);
      const [{ data: prof }, { data: vendors }] = await Promise.all([
        supabase.from("profiles").select("full_name, city, state").eq("id", user.id).maybeSingle(),
        supabase.from("vendors").select("id, slug, business_name").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1),
      ]);
      setProfile(prof ?? null);
      setExistingVendor(vendors?.[0] ?? null);
      setSellerName(vendors?.[0]?.business_name ?? prof?.full_name ?? "");
      setChecking(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switching type realigns the default category (unless they picked one already).
  function pickType(t: TypeKey) {
    setCategory((cur) => (TYPES.some((x) => x.cat === cur) ? metaFor(t).cat : cur));
    setType(t);
    if (t === "thrift") setCondition("used");
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []).slice(0, 6));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!existingVendor && !sellerName.trim()) { setError("Add a name so neighbors know who they're dealing with."); return; }
    if (!title.trim()) { setError("Give your listing a title."); return; }
    setSaving(true);
    setError(null);

    try {
      // 1) Get-or-create the lightweight personal seller profile.
      let vendorId = existingVendor?.id ?? null;
      let vendorSlug = existingVendor?.slug ?? null;
      if (!vendorId) {
        const stateAbbr = profile?.state ? normalizeState(profile.state) : "";
        const slug = `${slugify(sellerName)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: created, error: vErr } = await supabase
          .from("vendors")
          .insert({
            user_id: userId, business_name: sellerName.trim(), slug,
            category: meta.cat, city: profile?.city ?? "", state: stateAbbr,
            zip_code: "", is_business: false, tier: "free", is_active: true,
          })
          .select("id, slug")
          .single();
        if (vErr) throw vErr;
        vendorId = created.id; vendorSlug = created.slug;
        await supabase.from("profiles").update({ role: "vendor" }).eq("id", userId);
      }

      // 2) Upload photos.
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${vendorId}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { error: upErr } = await supabase.storage.from("listing-images").upload(path, f, { upsert: true });
        if (!upErr) imageUrls.push(supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
      }

      // 3) Per-type extras stored in tags[] (same format the rest of the app reads).
      const tags: string[] = [];
      if (meta.event) tags.push(`__event:${JSON.stringify(event)}`);
      if (meta.housing) {
        tags.push(`__housing:${JSON.stringify({
          address: housing.address, bedrooms: housing.bedrooms, bathrooms: housing.bathrooms,
          sqft: housing.sqft, lot_size: "", year_built: "", garage: false, pets_allowed: false,
          furnished: false, available_date: meta.available ? housing.available_date : "",
          lease_term: "12 months",
        })}`);
      }

      const priceNum = price.trim() ? Number(price.replace(/[^0-9.]/g, "")) : null;
      const { error: lErr } = await supabase.from("listings").insert({
        vendor_id: vendorId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        category,
        cta_type: defaultCtaForListingType(type),
        price: priceNum,
        ...(meta.condition ? { condition } : {}),
        ...(meta.pickup ? { porch_pickup: pickup } : {}),
        images: imageUrls,
        tags,
        is_active: true,
      });
      if (lErr) throw lErr;

      router.push(vendorSlug ? `/vendors/${vendorSlug}` : "/dashboard/vendor");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't post your listing. Try again.");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-sm text-gray-500">Create a listing</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create a listing</h1>
        <p className="text-gray-500 text-sm mb-5">
          Posting as a <strong>private seller</strong> — no business account needed. Pick a type, fill the basics, and you’re live.
        </p>

        {/* Type selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => pickType(t.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                type === t.value ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-green-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {!existingVendor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="Your name or a casual shop name" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">How you’ll show on your listings. You can change it later.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{meta.titleLabel}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={meta.titlePlaceholder} className={inputCls} />
          </div>

          <div className={meta.condition ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{meta.priceLabel}</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$0" className={inputCls} />
            </div>
            {meta.condition && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value as "used" | "new")} className={inputCls}>
                  <option value="used">Used</option>
                  <option value="new">New</option>
                </select>
              </div>
            )}
          </div>

          {/* Event-only fields */}
          {meta.event && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                  <input type="time" value={event.start_time} onChange={(e) => setEvent({ ...event, start_time: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                  <input type="time" value={event.end_time} onChange={(e) => setEvent({ ...event, end_time: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <input value={event.location} onChange={(e) => setEvent({ ...event, location: e.target.value })} placeholder="Where is it?" className={inputCls} />
              </div>
            </div>
          )}

          {/* Housing-only fields */}
          {meta.housing && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input value={housing.address} onChange={(e) => setHousing({ ...housing, address: e.target.value })} placeholder="Street, City" className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beds</label>
                  <input value={housing.bedrooms} onChange={(e) => setHousing({ ...housing, bedrooms: e.target.value })} inputMode="numeric" placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Baths</label>
                  <input value={housing.bathrooms} onChange={(e) => setHousing({ ...housing, bathrooms: e.target.value })} inputMode="numeric" placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sq ft</label>
                  <input value={housing.sqft} onChange={(e) => setHousing({ ...housing, sqft: e.target.value })} inputMode="numeric" placeholder="0" className={inputCls} />
                </div>
              </div>
              {meta.available && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Available from</label>
                  <input type="date" value={housing.available_date} onChange={(e) => setHousing({ ...housing, available_date: e.target.value })} className={inputCls} />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Photos</p>
            <label className="flex flex-col items-center justify-center gap-1 w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-green-400 hover:bg-green-50 transition-colors">
              <span className="text-2xl leading-none">📷</span>
              <span className="text-sm font-semibold text-green-700">Choose photos</span>
              <span className="text-xs text-gray-400">Up to 6 · JPG or PNG</span>
              <input type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
            </label>
            {files.length > 0 && <p className="text-xs text-gray-500 mt-2 font-medium">✓ {files.length} photo{files.length > 1 ? "s" : ""} selected</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Details that help neighbors decide…" className={inputCls} />
          </div>

          {meta.pickup && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="rounded" />
              Offer local pickup
            </label>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={saving} className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
            {saving ? "Posting…" : "Post listing"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Selling a single item instead?{" "}
            <a href="/sell" className="text-green-600 font-medium hover:underline">Sell something →</a>
          </p>
        </form>
      </div>
    </div>
  );
}
