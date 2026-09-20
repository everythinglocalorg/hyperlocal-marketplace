"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { CATEGORIES } from "@/types";
import { makeSlug, normalizeState } from "@/lib/cities";
import Logo from "@/components/Logo";

// Self-serve "sell an item" flow for ANY logged-in user — no business account
// needed. The first time someone lists, we quietly create a lightweight personal
// seller profile (a vendor row with is_business=false) so all the existing
// listing / cart / offer / messaging plumbing just works.
export default function SellPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingVendor, setExistingVendor] = useState<{ id: string; slug: string; business_name: string; is_business: boolean } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; city: string | null; state: string | null } | null>(null);

  // Form
  const [sellerName, setSellerName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "Clothing & Accessories");
  const [condition, setCondition] = useState<"used" | "new">("used");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [porchPickup, setPorchPickup] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login?next=/sell"); return; }
      setUserId(user.id);
      const [{ data: prof }, { data: vendors }] = await Promise.all([
        supabase.from("profiles").select("full_name, city, state").eq("id", user.id).maybeSingle(),
        supabase.from("vendors").select("id, slug, business_name, is_business").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1),
      ]);
      setProfile(prof ?? null);
      setExistingVendor(vendors?.[0] ?? null);
      setSellerName(vendors?.[0]?.business_name ?? prof?.full_name ?? "");
      setChecking(false);
    })();
    // eslint-disable-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 6);
    setFiles(picked);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!existingVendor && !sellerName.trim()) { setError("Add a seller name so buyers know who they're dealing with."); return; }
    if (!title.trim()) { setError("Give your item a title."); return; }
    setSaving(true);
    setError(null);

    try {
      // 1) Get-or-create the seller profile (individual, is_business=false).
      let vendorId = existingVendor?.id ?? null;
      let vendorSlug = existingVendor?.slug ?? null;
      if (!vendorId) {
        const stateAbbr = profile?.state ? normalizeState(profile.state) : "";
        const slug = `${slugify(sellerName)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: created, error: vErr } = await supabase
          .from("vendors")
          .insert({
            user_id: userId,
            business_name: sellerName.trim(),
            slug,
            category: "Community", // neutral bucket for individuals
            city: profile?.city ?? "",
            state: stateAbbr,
            zip_code: "",
            is_business: false,
            tier: "free",
            is_active: true,
          })
          .select("id, slug")
          .single();
        if (vErr) throw vErr;
        vendorId = created.id;
        vendorSlug = created.slug;
        // Give them a seller dashboard home so they can manage this listing.
        // (The vendor dashboard slims itself for individuals via is_business.)
        await supabase.from("profiles").update({ role: "vendor" }).eq("id", userId);
      }

      // 2) Upload photos to the shared listing-images bucket.
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${vendorId}/${Date.now()}-${i}-${f.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
        const { error: upErr } = await supabase.storage.from("listing-images").upload(path, f, { upsert: true });
        if (!upErr) {
          imageUrls.push(supabase.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
        }
      }

      // 3) Create the listing. Used goods → thrift (offers + SOLD state);
      //    new items → product. Priced with a Buy Now CTA.
      const priceNum = price.trim() ? Number(price.replace(/[^0-9.]/g, "")) : null;
      const { error: lErr } = await supabase.from("listings").insert({
        vendor_id: vendorId,
        title: title.trim(),
        description: description.trim() || null,
        type: condition === "used" ? "thrift" : "product",
        category,
        cta_type: "buy",
        price: priceNum,
        condition,
        images: imageUrls,
        porch_pickup: porchPickup,
        is_active: true,
      });
      if (lErr) throw lErr;

      router.push(vendorSlug ? `/vendors/${vendorSlug}` : "/dashboard/vendor");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't post your item. Try again.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-sm text-gray-500">Sell an item</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">List something for sale</h1>
        <p className="text-gray-500 text-sm mb-6">
          You're posting as a <strong>private seller</strong> — no business account needed. Local neighbors can message you and make offers.
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {!existingVendor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seller name</label>
              <input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Your name or a casual shop name (e.g. Jane's Garage)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">This is how you'll show on your listings. You can change it later.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What are you selling?</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Solid oak dresser"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="$0"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as "used" | "new")}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="used">Used</option>
                <option value="new">New</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
            <input type="file" accept="image/*" multiple onChange={onPickFiles} className="block w-full text-sm text-gray-600" />
            {files.length > 0 && <p className="text-xs text-gray-400 mt-1">{files.length} photo{files.length > 1 ? "s" : ""} selected</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Condition details, dimensions, pickup notes…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={porchPickup} onChange={(e) => setPorchPickup(e.target.checked)} className="rounded" />
            Offer local pickup
          </label>

          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Posting…" : "Post item for sale"}
          </button>
          <p className="text-center text-xs text-gray-400">
            Want a full business storefront instead?{" "}
            <a href="/onboarding/vendor" className="text-green-600 font-medium hover:underline">Open one free →</a>
          </p>
        </form>
      </div>
    </div>
  );
}
