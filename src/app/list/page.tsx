"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { makeSlug, normalizeState } from "@/lib/cities";
import { defaultCtaForListingType } from "@/lib/cta";
import RentalSetup, { type RentalSettings } from "@/components/rental/RentalSetup";

// Adaptive "create a listing" flow for ANY logged-in user (no business account
// needed). ONE template, Type selector, only the fields each type needs — and the
// same rich rate/booking setups the vendor dashboard uses (rentals get duration
// rates + hours/deposit, housing gets full details, services set their rates).
// Product ("Sell Something") and Food have their own flows and aren't here.

type TypeKey = "product" | "service" | "event" | "thrift" | "animals" | "housing_sale" | "rental" | "housing_rent";

const TYPES: {
  value: TypeKey; label: string; cat: string; priceLabel: string;
  titleLabel: string; titlePlaceholder: string;
  condition?: boolean; pickup?: boolean; event?: boolean; housing?: boolean; available?: boolean;
  rental?: boolean; service?: boolean; hidePrice?: boolean; thrift?: boolean;
  animal?: boolean; quantity?: boolean;
}[] = [
  { value: "product", label: "Item for Sale", cat: "Products", priceLabel: "Price", titleLabel: "What are you selling?", titlePlaceholder: "e.g. Mountain bike, Dining table, iPhone 13", condition: true, pickup: true, quantity: true },
  { value: "service", label: "Service", cat: "Services & Trades", priceLabel: "", titleLabel: "Service name", titlePlaceholder: "e.g. Lawn mowing, House cleaning", service: true, hidePrice: true },
  { value: "event", label: "Event", cat: "Events & Rentals", priceLabel: "Ticket price (blank = free)", titleLabel: "Event name", titlePlaceholder: "e.g. Summer Night Market", event: true },
  { value: "thrift", label: "Thrift Sale", cat: "Thrift Sales", priceLabel: "", titleLabel: "Sale / shop name", titlePlaceholder: "e.g. Maple St. Garage Sale, Corner Thrift", thrift: true, hidePrice: true },
  { value: "animals", label: "Animals / Livestock", cat: "Pet Services", priceLabel: "Price (blank = inquire)", titleLabel: "Listing title", titlePlaceholder: "e.g. Border Collie puppies, Laying hens", animal: true },
  { value: "housing_sale", label: "House for Sale", cat: "Housing & Rentals", priceLabel: "Price", titleLabel: "Listing title", titlePlaceholder: "e.g. 3 bed ranch on Oak St", housing: true },
  { value: "rental", label: "Rental", cat: "Events & Rentals", priceLabel: "", titleLabel: "What are you renting out?", titlePlaceholder: "e.g. Kayak, Party tent", pickup: true, rental: true, hidePrice: true },
  { value: "housing_rent", label: "Housing (For Rent)", cat: "Housing & Rentals", priceLabel: "Monthly rent", titleLabel: "Listing title", titlePlaceholder: "e.g. 2 bed apartment downtown", housing: true, available: true },
];

function metaFor(t: TypeKey) { return TYPES.find((x) => x.value === t) ?? TYPES[0]; }

const EMPTY_RENTAL: RentalSettings = {
  rental_mode: "hourly", rental_buffer_hours: "0", rental_quantity: "1",
  waiver_body: "", fareharbor_shortname: "", fareharbor_flow: "",
  rental_deposit_type: "none", rental_deposit_value: "50",
};

export default function ListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingVendor, setExistingVendor] = useState<{ id: string; slug: string; business_name: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; city: string | null; state: string | null } | null>(null);

  const [type, setType] = useState<TypeKey>("product");
  const [sellerName, setSellerName] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [condition, setCondition] = useState<"used" | "new">("used");
  const [pickup, setPickup] = useState(true);
  const [event, setEvent] = useState({ date: "", start_time: "", end_time: "", location: "" });
  // Thrift = a little store: where it is, which days/hours it's open, and whether
  // it's an ongoing sale that can be toggled "open" (like food trucks).
  const [thrift, setThrift] = useState({
    location: "",
    ongoing: false,
    days: [
      { day: "Monday", open: "", close: "", closed: false },
      { day: "Tuesday", open: "", close: "", closed: false },
      { day: "Wednesday", open: "", close: "", closed: false },
      { day: "Thursday", open: "", close: "", closed: false },
      { day: "Friday", open: "", close: "", closed: false },
      { day: "Saturday", open: "", close: "", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ],
  });
  const [housing, setHousing] = useState({
    address: "", bedrooms: "", bathrooms: "", sqft: "", lot_size: "",
    year_built: "", garage: false, pets_allowed: false, furnished: false,
    available_date: "", lease_term: "12 months",
  });
  const [service, setService] = useState<{ rate_type: "hourly" | "flat" | "quote"; rate: string; cost_rate: string }>({ rate_type: "hourly", rate: "", cost_rate: "" });
  const [quantity, setQuantity] = useState("");
  // Animals / livestock — same detail shape the dashboard + listing modal read.
  const [animal, setAnimal] = useState({
    species: "", breed: "", age: "", sex: "", quantity: "", location: "",
    vet_checked: false, vaccinated: false, fixed: false, registered: false,
    microchipped: false, health_guarantee: false,
    good_with_kids: false, good_with_pets: false, notes: "",
  });
  // Rental rates + booking (reuses the dashboard's RentalSetup component).
  const [rentalDurations, setRentalDurations] = useState<{ label: string; hours: number; price: number }[]>([]);
  const [rentalSettings, setRentalSettings] = useState<RentalSettings>(EMPTY_RENTAL);
  const [rentalWaiverUrl, setRentalWaiverUrl] = useState<string | null>(null);
  const [rentalWaiverFilename, setRentalWaiverFilename] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = metaFor(type);

  useEffect(() => {
    (async () => {
      let initial: TypeKey = "product";
      try {
        const t = new URLSearchParams(window.location.search).get("type") as TypeKey | null;
        if (t && TYPES.some((x) => x.value === t)) initial = t;
      } catch { /* noop */ }
      setType(initial);
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

  function pickType(t: TypeKey) {
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

      // 3) Per-type extras in tags[] (same format the rest of the app reads).
      const tags: string[] = [];
      if (meta.event) tags.push(`__event:${JSON.stringify(event)}`);
      if (meta.housing) tags.push(`__housing:${JSON.stringify({ ...housing, available_date: meta.available ? housing.available_date : "" })}`);
      if (meta.service) tags.push(`__service:${JSON.stringify(service)}`);
      if (meta.animal) tags.push(`__animal:${JSON.stringify(animal)}`);
      if (meta.thrift) {
        // Weekly schedule → __hours (same shape the board/modal read); the ongoing
        // "open" flag → __thrift. Location rides in price_label (thrift convention).
        tags.push(`__hours:${JSON.stringify(thrift.days)}`);
        tags.push(`__thrift:${JSON.stringify({ ongoing: thrift.ongoing })}`);
      }

      // Price: services use their rate; rentals price per-duration (null here).
      let priceNum: number | null = price.trim() ? Number(price.replace(/[^0-9.]/g, "")) : null;
      let priceLabel: string | null = null;
      if (meta.service) {
        priceNum = service.rate_type === "quote" ? null : (service.rate ? Number(service.rate.replace(/[^0-9.]/g, "")) : null);
        priceLabel = service.rate_type === "hourly" ? "per hour" : service.rate_type === "quote" ? "Free quote" : null;
      }
      if (meta.rental) priceNum = null;
      if (meta.thrift) { priceNum = null; priceLabel = thrift.location.trim() || null; }

      // 4) Create the listing (with rental columns when applicable).
      const base: Record<string, any> = {
        vendor_id: vendorId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        category: meta.cat,
        cta_type: defaultCtaForListingType(type),
        price: priceNum,
        price_label: priceLabel,
        ...(meta.condition ? { condition } : {}),
        ...(meta.quantity ? { quantity: quantity.trim() ? Number(quantity) : null } : {}),
        ...(meta.pickup ? { porch_pickup: pickup } : {}),
        images: imageUrls,
        tags,
        is_active: true,
        ...(meta.rental ? {
          waiver_url: rentalWaiverUrl,
          waiver_filename: rentalWaiverFilename,
          waiver_body: rentalSettings.waiver_body || null,
          rental_mode: rentalSettings.rental_mode,
          rental_buffer_hours: Number(rentalSettings.rental_buffer_hours) || 0,
          rental_quantity: Math.max(1, Number(rentalSettings.rental_quantity) || 1),
          rental_deposit_type: rentalSettings.rental_deposit_type || "none",
          rental_deposit_value: Number(rentalSettings.rental_deposit_value) || 0,
        } : {}),
      };

      let { data: created, error: lErr } = await supabase.from("listings").insert(base).select("id").single();
      if (lErr && lErr.code === "42703") {
        // Optional rental columns not migrated — retry without them.
        const { waiver_url, waiver_filename, waiver_body, rental_mode, rental_buffer_hours, rental_quantity, rental_deposit_type, rental_deposit_value, ...safe } = base;
        const res = await supabase.from("listings").insert(safe).select("id").single();
        created = res.data; lErr = res.error;
      }
      if (lErr) throw lErr;

      // 5) Rental duration rates.
      if (meta.rental && created?.id && rentalDurations.length > 0) {
        try {
          await supabase.from("rental_durations").insert(rentalDurations.map((d) => ({ listing_id: created!.id, ...d })));
        } catch { /* table not migrated — rates still saved on the listing */ }
      }

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

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white transition-shadow placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pt-7 pb-28">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 mb-3">
          ✨ New listing
        </span>
        <h1 className="text-[1.7rem] leading-tight font-black tracking-tight text-gray-900">Create a listing</h1>
        <p className="text-gray-500 text-sm mt-1.5 mb-6">
          Posting as a <strong className="font-semibold text-gray-700">private seller</strong> — no business account needed. Pick a type, fill the basics, and you’re live.
        </p>

        {/* Type selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-5 -mx-4 px-4">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => pickType(t.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                type === t.value
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-600/25 scale-105"
                  : "bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-green-900/5 p-6 sm:p-7 space-y-5">
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

          {/* Price / condition (hidden for rentals & services, which set rates below) */}
          {!meta.hidePrice && (
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
          )}

          {/* Quantity in stock (products) */}
          {meta.quantity && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity in stock <span className="font-normal text-gray-400">(optional)</span></label>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" placeholder="Leave blank for a one-off item" className={inputCls} />
            </div>
          )}

          {/* Service rates */}
          {meta.service && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800">How you charge</p>
              <div className="flex gap-2">
                {([["hourly", "Hourly"], ["flat", "Flat rate"], ["quote", "Free quote"]] as const).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setService({ ...service, rate_type: val })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${service.rate_type === val ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-green-300"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              {service.rate_type !== "quote" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{service.rate_type === "hourly" ? "Rate ($/hr)" : "Price"}</label>
                    <input value={service.rate} onChange={(e) => setService({ ...service, rate: e.target.value })} inputMode="decimal" placeholder="$0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your cost ({service.rate_type === "hourly" ? "$/hr" : "$"}) <span className="text-gray-400 font-normal">· private</span></label>
                    <input value={service.cost_rate} onChange={(e) => setService({ ...service, cost_rate: e.target.value })} inputMode="decimal" placeholder="$0" className={inputCls} />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400">Your cost stays private — it just powers your estimates and profit tracking.</p>
            </div>
          )}

          {/* Rental rates + booking (reused dashboard setup) */}
          {meta.rental && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800 mb-2">Rates &amp; booking</p>
              <RentalSetup
                listingId={null}
                supabase={supabase}
                vendorId={existingVendor?.id ?? ""}
                waiverUrl={rentalWaiverUrl}
                waiverFilename={rentalWaiverFilename}
                initialSettings={rentalSettings}
                onWaiverUploaded={(url, fn) => { setRentalWaiverUrl(url); setRentalWaiverFilename(fn); }}
                onDurationsChange={setRentalDurations}
                onSettingsChange={setRentalSettings}
              />
            </div>
          )}

          {/* Event details */}
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

          {/* Thrift store details — location + open days/hours + ongoing toggle */}
          {meta.thrift && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <input value={thrift.location} onChange={(e) => setThrift({ ...thrift, location: e.target.value })} placeholder="Address or where to find you" className={inputCls} />
              </div>
              <label className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${thrift.ongoing ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                <input type="checkbox" checked={thrift.ongoing} onChange={() => setThrift({ ...thrift, ongoing: !thrift.ongoing })} className="accent-green-600 mt-0.5" />
                <span>🟢 Ongoing sale — I open on a regular schedule (you can toggle it &ldquo;open&rdquo; like a food truck)</span>
              </label>
              <div>
                <p className="block text-xs font-medium text-gray-600 mb-1.5">Days &amp; hours open</p>
                <div className="space-y-1.5">
                  {thrift.days.map((d, i) => (
                    <div key={d.day} className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 w-24 shrink-0 text-sm text-gray-700">
                        <input type="checkbox" checked={!d.closed} onChange={() => setThrift((t) => ({ ...t, days: t.days.map((x, xi) => xi === i ? { ...x, closed: !x.closed } : x) }))} className="accent-green-600" />
                        {d.day.slice(0, 3)}
                      </label>
                      {d.closed ? (
                        <span className="text-xs text-gray-400">Closed</span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input type="time" value={d.open} onChange={(e) => setThrift((t) => ({ ...t, days: t.days.map((x, xi) => xi === i ? { ...x, open: e.target.value } : x) }))} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                          <span className="text-xs text-gray-400">to</span>
                          <input type="time" value={d.close} onChange={(e) => setThrift((t) => ({ ...t, days: t.days.map((x, xi) => xi === i ? { ...x, close: e.target.value } : x) }))} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Animal / livestock details */}
          {meta.animal && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">🐾 Animal details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type of animal</label>
                  <select value={animal.species} onChange={(e) => setAnimal((a) => ({ ...a, species: e.target.value }))} className={inputCls}>
                    <option value="">Select…</option>
                    {["Dog","Cat","Horse","Chicken","Duck","Turkey","Goat","Sheep","Cattle","Pig","Rabbit","Bird","Reptile","Fish","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Breed <span className="font-normal text-gray-400">(optional)</span></label>
                  <input value={animal.breed} onChange={(e) => setAnimal((a) => ({ ...a, breed: e.target.value }))} placeholder="e.g. Border Collie, Angus" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input value={animal.age} onChange={(e) => setAnimal((a) => ({ ...a, age: e.target.value }))} placeholder="8 wks, 2 yr" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
                  <select value={animal.sex} onChange={(e) => setAnimal((a) => ({ ...a, sex: e.target.value }))} className={inputCls}>
                    <option value="">Select…</option>
                    {["Male","Female","Mixed group","Unknown"].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                  <input value={animal.quantity} onChange={(e) => setAnimal((a) => ({ ...a, quantity: e.target.value }))} placeholder="1, litter of 6" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location <span className="font-normal text-gray-400">(where the animal can be seen)</span></label>
                <input value={animal.location} onChange={(e) => setAnimal((a) => ({ ...a, location: e.target.value }))} placeholder="e.g. Faribault, MN" className={inputCls} />
              </div>
              <div>
                <p className="block text-xs font-medium text-gray-600 mb-1.5">Health &amp; care</p>
                <div className="flex flex-wrap gap-2">
                  {([["vet_checked","🩺 Seen a vet"],["vaccinated","💉 Vaccinated"],["fixed","✂️ Spayed / Neutered"],["microchipped","🔖 Microchipped"],["registered","📋 Papers"],["health_guarantee","✅ Health guarantee"]] as const).map(([key, lbl]) => (
                    <button key={key} type="button" onClick={() => setAnimal((a) => ({ ...a, [key]: !(a as any)[key] }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${(animal as any)[key] ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="block text-xs font-medium text-gray-600 mb-1.5">Temperament <span className="font-normal text-gray-400">(optional)</span></p>
                <div className="flex flex-wrap gap-2">
                  {([["good_with_kids","👶 Good with kids"],["good_with_pets","🐕 Good with other animals"]] as const).map(([key, lbl]) => (
                    <button key={key} type="button" onClick={() => setAnimal((a) => ({ ...a, [key]: !(a as any)[key] }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${(animal as any)[key] ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Housing details */}
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lot size</label>
                  <input value={housing.lot_size} onChange={(e) => setHousing({ ...housing, lot_size: e.target.value })} placeholder="e.g. 0.25 ac" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year built</label>
                  <input value={housing.year_built} onChange={(e) => setHousing({ ...housing, year_built: e.target.value })} inputMode="numeric" placeholder="e.g. 1998" className={inputCls} />
                </div>
              </div>
              {meta.available && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Available from</label>
                    <input type="date" value={housing.available_date} onChange={(e) => setHousing({ ...housing, available_date: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lease term</label>
                    <select value={housing.lease_term} onChange={(e) => setHousing({ ...housing, lease_term: e.target.value })} className={inputCls}>
                      {["Month to month", "6 months", "12 months", "18 months"].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {([["garage", "Garage"], ["pets_allowed", "Pets OK"], ["furnished", "Furnished"]] as const).map(([key, lbl]) => (
                  <button key={key} type="button" onClick={() => setHousing({ ...housing, [key]: !(housing as any)[key] })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${(housing as any)[key] ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl py-3.5 text-base font-bold shadow-lg shadow-green-600/25 hover:brightness-110 active:scale-[.99] transition disabled:opacity-50">
            {saving ? "Posting…" : "Post listing"}
          </button>
        </form>
      </div>
    </div>
  );
}
