"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";
import { geocodeQuery, getBrowserLocation, reverseGeocode } from "@/lib/geocode";
import ImageUpload from "@/components/ui/ImageUpload";
import { PLACE_TYPES, PLACE_AMENITIES, PLACE_ACTIVITIES, PAID_PLACE_TYPES } from "@/types";
import type { PlaceType, PlaceFees } from "@/types";
import { MapPin, Loader2, DollarSign } from "lucide-react";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Location" },
  { id: 3, label: "Details" },
  { id: 4, label: "Photos & Tags" },
];

type FormData = {
  name: string;
  type: PlaceType;
  subtype: string;
  description: string;
  address: string;
  zip: string;
  fees: PlaceFees;
  fee_details: string;
  website: string;
  phone: string;
};

type GeoLocation = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  displayName: string;
} | null;

const INITIAL: FormData = {
  name: "",
  type: "park",
  subtype: "",
  description: "",
  address: "",
  zip: "",
  fees: "free",
  fee_details: "",
  website: "",
  phone: "",
};

interface Props {
  userId: string;
  vendorId?: string | null;      // if user has a vendor account
  vendorName?: string | null;
}

export default function AddPlaceClient({ userId, vendorId, vendorName }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [geo, setGeo] = useState<GeoLocation>(null);
  const [citySearch, setCitySearch] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [linkVendor, setLinkVendor] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = PAID_PLACE_TYPES.includes(form.type);
  const isFoodTruck = form.type === "food_truck";

  function set(key: keyof FormData, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function detectLocation() {
    setLocLoading(true);
    setLocError(null);
    try {
      const pos = await getBrowserLocation();
      const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (result) {
        setGeo({ city: result.city, state: result.state, latitude: result.latitude, longitude: result.longitude, displayName: result.displayName });
      } else {
        setLocError("Couldn't detect location. Try searching.");
      }
    } catch {
      setLocError("Location permission denied. Try searching.");
    } finally {
      setLocLoading(false);
    }
  }

  async function searchLocation() {
    if (!citySearch.trim()) return;
    setLocLoading(true);
    setLocError(null);
    try {
      const result = await geocodeQuery(citySearch);
      if (result) {
        setGeo({ city: result.city, state: result.state, latitude: result.latitude, longitude: result.longitude, displayName: result.displayName });
      } else {
        setLocError("Location not found. Try a more specific search.");
      }
    } catch {
      setLocError("Search failed. Try again.");
    } finally {
      setLocLoading(false);
    }
  }

  async function handleSubmit() {
    if (!geo) { setError("Please set a location."); return; }
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const makeSlug = (city: string, state: string) =>
        `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const slug = `${slugify(form.name)}-${makeSlug(geo.city, geo.state)}`;

      // Paid types start inactive; free types go live immediately.
      const isActive = !isPaid;

      const payload: Record<string, unknown> = {
        slug,
        name: form.name.trim(),
        type: form.type,
        subtype: form.subtype.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        city: geo.city,
        state: geo.state,
        zip: form.zip.trim() || null,
        city_slug: makeSlug(geo.city, geo.state),
        latitude: geo.latitude,
        longitude: geo.longitude,
        images,
        tags,
        amenities,
        activities,
        fees: form.fees,
        fee_details: form.fee_details.trim() || null,
        website: form.website.trim() || null,
        phone: form.phone.trim() || null,
        created_by: userId,
        is_active: isActive,
        vendor_id: (isFoodTruck && linkVendor && vendorId) ? vendorId : null,
      };

      const { data, error: insertError } = await supabase
        .from("places")
        .insert(payload)
        .select("id, slug")
        .single();

      if (insertError) throw insertError;

      if (isPaid) {
        // Send to Stripe checkout — webhook will flip is_active once paid.
        const res = await fetch("/api/places/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place_id: data.id }),
        });
        const out = await res.json();
        if (out.url) { window.location.href = out.url; return; }
        // Checkout failed — clean up the draft
        await supabase.from("places").delete().eq("id", data.id);
        throw new Error(out.error ?? "Could not start checkout. Please try again.");
      }

      router.push(`/places/${data.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Add a place</h1>
        <p className="text-sm text-gray-500 mb-6">Parks, campgrounds, attractions &amp; things to do</p>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${step >= s.id ? "bg-emerald-500" : "bg-gray-200"}`} />
              <p className={`text-xs mt-1 text-center ${step === s.id ? "text-emerald-600 font-medium" : "text-gray-400"}`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          {/* ── Step 1: Basic Info ── */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Lake Wissota State Park"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLACE_TYPES.map(({ value, label, paid }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("type", value)}
                      className={`relative text-sm py-2.5 rounded-xl border font-medium transition-colors ${
                        form.type === value
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"
                      }`}
                    >
                      {label}
                      {paid && (
                        <span className={`absolute top-1 right-1.5 text-[9px] font-bold ${form.type === value ? "text-emerald-200" : "text-emerald-500"}`}>
                          $5/mo
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {isPaid && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    {form.type === "food_truck" ? "Food Truck" : form.type === "attraction" ? "Attraction" : "Thing to Do"} listings are $5/month to keep your place featured on Everything Local.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtype <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  value={form.subtype}
                  onChange={(e) => set("subtype", e.target.value)}
                  placeholder={isFoodTruck ? "e.g. BBQ, Tacos, Ice Cream" : "e.g. State Park, Waterfall, Disc Golf Course"}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={4}
                  placeholder={isFoodTruck ? "What do you serve? What makes you unique?" : "What makes this place worth visiting?"}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>

              {/* Food truck: link to vendor account */}
              {isFoodTruck && vendorId && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <input
                    id="link-vendor"
                    type="checkbox"
                    checked={linkVendor}
                    onChange={(e) => setLinkVendor(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                  />
                  <label htmlFor="link-vendor" className="text-sm text-emerald-800">
                    Link to my <strong>{vendorName}</strong> storefront on Everything Local
                  </label>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locLoading}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm hover:border-emerald-400 disabled:opacity-50"
                >
                  {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-emerald-600" />}
                  Use my location
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchLocation()}
                  placeholder="Search city, address…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={searchLocation}
                  disabled={locLoading}
                  className="px-4 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  Search
                </button>
              </div>

              {locError && <p className="text-xs text-red-500">{locError}</p>}

              {geo && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
                  <MapPin className="inline w-3.5 h-3.5 mr-1" />
                  {geo.displayName}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street address <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder={isFoodTruck ? "Regular location or parking spot" : "123 Park Rd"}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP code <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.zip}
                  onChange={(e) => set("zip", e.target.value)}
                  placeholder="54701"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </>
          )}

          {/* ── Step 3: Details ── */}
          {step === 3 && (
            <>
              {!isFoodTruck && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {PLACE_AMENITIES.filter(a => !['Outdoor Seating','Card Accepted','Cash Only','Drive-Through'].includes(a)).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleArr(amenities, setAmenities, a)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          amenities.includes(a)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isFoodTruck && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service options</label>
                  <div className="flex flex-wrap gap-2">
                    {['Outdoor Seating','Card Accepted','Cash Only','Drive-Through','Pet-Friendly','ADA Accessible'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleArr(amenities, setAmenities, a)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          amenities.includes(a)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isFoodTruck && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Activities</label>
                  <div className="flex flex-wrap gap-2">
                    {PLACE_ACTIVITIES.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleArr(activities, setActivities, a)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          activities.includes(a)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isFoodTruck && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fees</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["free", "day-use", "camping", "varies"] as PlaceFees[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => set("fees", f)}
                        className={`text-sm py-2 rounded-xl border font-medium transition-colors capitalize ${
                          form.fees === f
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-700 border-gray-200 hover:border-emerald-400"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {form.fees !== "free" && (
                    <input
                      value={form.fee_details}
                      onChange={(e) => set("fee_details", e.target.value)}
                      placeholder="e.g. $5/vehicle, $25/night camping"
                      className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://"
                  type="url"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(715) 555-0100"
                  type="tel"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </>
          )}

          {/* ── Step 4: Photos & Tags ── */}
          {step === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Photos <span className="text-gray-400 font-normal">(optional)</span></label>
                <ImageUpload
                  bucket="place-images"
                  userId={userId}
                  currentUrl={images[0]}
                  onUpload={(url) => setImages([url, ...images.slice(1)])}
                  shape="banner"
                  label="Add a photo"
                  hint="JPG or PNG, max 5 MB"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Add a tag and press Enter"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button type="button" onClick={addTag} className="px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm">Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1">
                        {t}
                        <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Paid type summary */}
              {isPaid && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold mb-0.5">$5/month after you submit</p>
                  <p className="text-xs text-amber-600">You&apos;ll be taken to a secure Stripe checkout. Your listing goes live once payment is confirmed.</p>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-5">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="text-sm text-gray-500 hover:text-gray-800 px-4 py-2">
              Back
            </button>
          ) : <div />}

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !form.name.trim()) { setError("Name is required."); return; }
                if (step === 2 && !geo) { setError("Please set a location."); return; }
                setError(null);
                setStep(step + 1);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPaid ? "Continue to payment →" : "Add place"}
            </button>
          )}
        </div>
        {error && step < STEPS.length && <p className="text-xs text-red-500 mt-2 text-right">{error}</p>}
      </div>
    </div>
  );
}
