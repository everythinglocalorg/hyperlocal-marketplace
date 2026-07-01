"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LAUNCH_CITIES, CATEGORIES } from "@/types";
import { slugify } from "@/lib/utils";
import { geocodeQuery, getBrowserLocation, reverseGeocode } from "@/lib/geocode";
import ImageUpload from "@/components/ui/ImageUpload";

const STEPS = [
  { id: 1, label: "Business Info" },
  { id: 2, label: "Location" },
  { id: 3, label: "Your Story" },
  { id: 4, label: "Go Live" },
];

type FormData = {
  business_name: string;
  category: string;
  phone: string;
  website: string;
  address: string;
  zip_code: string;
  service_radius_miles: number;
  description: string;
  logo_url: string;
  banner_url: string;
};

type GeoLocation = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  displayName: string;
} | null;

const INITIAL: FormData = {
  business_name: "",
  category: "",
  phone: "",
  website: "",
  address: "",
  zip_code: "",
  service_radius_miles: 25,
  description: "",
  logo_url: "",
  banner_url: "",
};

export default function VendorOnboardingClient() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [geoLocation, setGeoLocation] = useState<GeoLocation>(null);
  const [citySearch, setCitySearch] = useState("");
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  async function detectVendorLocation() {
    setLocLoading(true);
    setLocError(null);
    try {
      const pos = await getBrowserLocation();
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (geo) {
        setGeoLocation({ city: geo.city, state: geo.state, latitude: geo.latitude, longitude: geo.longitude, displayName: geo.displayName });
      } else {
        setLocError("Couldn't identify your location. Try searching below.");
      }
    } catch {
      setLocError("Location access denied. Search for your city below.");
    } finally {
      setLocLoading(false);
    }
  }

  async function searchVendorCity() {
    if (!citySearch.trim()) return;
    setCitySearchLoading(true);
    setLocError(null);
    const geo = await geocodeQuery(citySearch);
    if (geo) {
      setGeoLocation({ city: geo.city, state: geo.state, latitude: geo.latitude, longitude: geo.longitude, displayName: geo.displayName });
    } else {
      setLocError("Couldn't find that location. Try a city name or ZIP code.");
    }
    setCitySearchLoading(false);
  }

  function set(field: keyof FormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function canAdvance() {
    if (step === 1) return form.business_name.trim() && form.category;
    if (step === 2) return geoLocation && form.zip_code.trim();
    if (step === 3) return form.description.trim().length >= 20;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const baseSlug = slugify(form.business_name);
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const { error: vendorError } = await supabase.from("vendors").insert({
      user_id: user.id,
      business_name: form.business_name,
      slug,
      category: form.category,
      phone: form.phone || null,
      website: form.website || null,
      city: geoLocation?.city ?? "",
      state: geoLocation?.state ?? "",
      zip_code: form.zip_code,
      address: form.address || null,
      latitude: geoLocation?.latitude ?? null,
      longitude: geoLocation?.longitude ?? null,
      location: geoLocation
        ? `POINT(${geoLocation.longitude} ${geoLocation.latitude})`
        : null,
      service_radius_miles: form.service_radius_miles,
      description: form.description,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      tier: "premium",
      features: { messages: true, analytics: true, bookings: true, crm: true, estimates: true },
    });

    if (vendorError) {
      setError(vendorError.message);
      setLoading(false);
      return;
    }

    // Update profile role to vendor
    await supabase
      .from("profiles")
      .update({ role: "vendor" })
      .eq("id", user.id);

    // Award profile completion Local Bucks
    await supabase.rpc("award_local_bucks", {
      p_user_id: user.id,
      p_amount: 25,
      p_reason: "complete_vendor_profile",
    });

    router.push("/dashboard/vendor?welcome=1");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-green-600">Everything Local</span>
          <span className="text-sm text-gray-500">Step {step} of {STEPS.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white h-1.5">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${(step / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s.id < step ? "bg-green-500 text-white" :
                s.id === step ? "bg-green-600 text-white ring-4 ring-green-100" :
                "bg-gray-200 text-gray-400"
              }`}>
                {s.id < step ? "✓" : s.id}
              </div>
              {s.id < STEPS.length && (
                <div className={`w-8 h-0.5 ${s.id < step ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          {/* STEP 1 — Business Info */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">🏪</div>
                <h1 className="text-2xl font-bold text-gray-900">Tell us about your business</h1>
                <p className="text-gray-500 text-sm mt-1">This is what customers will see first.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.business_name}
                    onChange={(e) => set("business_name", e.target.value)}
                    placeholder="e.g. Mario's Italian Kitchen"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set("category", c)}
                        className={`px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                          form.category === c
                            ? "border-green-500 bg-green-50 text-green-700 font-medium"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(715) 555-0100"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

              </div>
            </div>
          )}

          {/* STEP 2 — Location */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">📍</div>
                <h1 className="text-2xl font-bold text-gray-900">Where are you located?</h1>
                <p className="text-gray-500 text-sm mt-1">Customers will use this to find you by distance.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>

                  {/* Detected city */}
                  {geoLocation && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">📍</span>
                        <div>
                          <p className="font-semibold text-green-800 text-sm">{geoLocation.displayName}</p>
                          <p className="text-xs text-green-600">Location confirmed</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setGeoLocation(null)} className="text-xs text-green-600 hover:underline">Change</button>
                    </div>
                  )}

                  {!geoLocation && (
                    <>
                      {/* GPS detect */}
                      <button
                        type="button"
                        onClick={detectVendorLocation}
                        disabled={locLoading}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors mb-3 disabled:opacity-60"
                      >
                        {locLoading
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <span>📡</span>}
                        {locLoading ? "Detecting..." : "Use my current location"}
                      </button>

                      <div className="relative my-3">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">or search</span></div>
                      </div>

                      {/* City/ZIP search */}
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && searchVendorCity()}
                          placeholder="City name or ZIP code..."
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                          type="button"
                          onClick={searchVendorCity}
                          disabled={citySearchLoading || !citySearch.trim()}
                          className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                        >
                          {citySearchLoading ? "..." : "Search"}
                        </button>
                      </div>

                      {/* Quick picks */}
                      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Launch cities</p>
                      <div className="grid grid-cols-2 gap-2">
                        {LAUNCH_CITIES.map((city) => (
                          <button
                            key={city.slug}
                            type="button"
                            onClick={() => setGeoLocation({ city: city.name, state: city.state, latitude: city.latitude, longitude: city.longitude, displayName: `${city.name}, ${city.state}` })}
                            className="p-3 rounded-xl border-2 border-gray-200 text-left hover:border-green-400 hover:bg-green-50 transition-all"
                          >
                            <p className="font-semibold text-gray-900 text-sm">{city.name}</p>
                            <p className="text-xs text-gray-500">{city.state}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {locError && <p className="text-xs text-red-600 mt-2">{locError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="123 Main St"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => set("zip_code", e.target.value)}
                    placeholder="54701"
                    maxLength={5}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service radius: <span className="text-green-600 font-semibold">{form.service_radius_miles} miles</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">How far do you serve customers? (great for trades & delivery)</p>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={form.service_radius_miles}
                    onChange={(e) => set("service_radius_miles", Number(e.target.value))}
                    className="w-full accent-green-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 mi (local only)</span>
                    <span>50 mi (regional)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Your Story */}
          {step === 3 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">✍️</div>
                <h1 className="text-2xl font-bold text-gray-900">Tell your story</h1>
                <p className="text-gray-500 text-sm mt-1">Help customers understand what makes you special — and ditch that old website.</p>
              </div>

              <div className="space-y-5">
                {/* Cover photo — full width, banner style */}
                {userId && (
                  <ImageUpload
                    bucket="vendor-banners"
                    userId={userId}
                    currentUrl={form.banner_url || undefined}
                    onUpload={(url) => set("banner_url", url)}
                    shape="banner"
                    label="Cover photo"
                    hint="The big hero image on your storefront — show off your space, your work, or your product. Recommended: 1200×400px."
                  />
                )}

                {/* Profile photo — square logo */}
                {userId && (
                  <ImageUpload
                    bucket="vendor-logos"
                    userId={userId}
                    currentUrl={form.logo_url || undefined}
                    onUpload={(url) => set("logo_url", url)}
                    shape="square"
                    label="Profile photo"
                    hint="Your logo or a photo of you/your team. Shown as a small thumbnail next to your name. Recommended: 400×400px."
                  />
                )}

                {/* About */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    About your business <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={5}
                    placeholder="Tell customers what you offer, your experience, what makes you different. Think of this as your homepage — make it count!"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-gray-400">Minimum 20 characters</p>
                    <p className={`text-xs ${form.description.length >= 20 ? "text-green-500" : "text-gray-400"}`}>
                      {form.description.length} chars
                    </p>
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔗</span>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="w-full pl-9 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Got a website? Link it. But many vendors find their Everything Local storefront replaces it entirely — it's free, mobile-ready, and gets you found locally.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 font-medium">🪙 Earn 25 Local Bucks for completing your profile!</p>
                  <p className="text-xs text-amber-600 mt-0.5">You'll receive them instantly when you go live.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Review & Go Live */}
          {step === 4 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">🚀</div>
                <h1 className="text-2xl font-bold text-gray-900">Ready to go live?</h1>
                <p className="text-gray-500 text-sm mt-1">Here's a summary of your listing before we publish it.</p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { label: "Business", value: form.business_name },
                  { label: "Category", value: form.category },
                  { label: "City", value: geoLocation?.displayName ?? "—" },
                  { label: "ZIP", value: form.zip_code },
                  { label: "Service radius", value: `${form.service_radius_miles} miles` },
                  { label: "Phone", value: form.phone || "—" },
                  { label: "Website", value: form.website || "—" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between py-2 border-b border-gray-100 text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-800 font-semibold">What happens next:</p>
                <ul className="mt-2 space-y-1 text-sm text-green-700">
                  <li>✓ Your storefront goes live immediately</li>
                  <li>✓ You earn 25 Local Bucks for completing your profile</li>
                  <li>✓ Add unlimited listings from your dashboard</li>
                  <li>✓ Full Local Pro access starts today — free for 30 days</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span>🏅</span>
                  <p className="text-sm font-bold text-amber-800">Your 30-Day Local Pro Trial</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { icon: "📊", label: "Analytics" },
                    { icon: "📋", label: "Estimate Manager" },
                    { icon: "👥", label: "Customer CRM" },
                    { icon: "💬", label: "Messaging" },
                    { icon: "⭐", label: "Verified Badge" },
                    { icon: "🔝", label: "Priority Search" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-amber-800">
                      <span>{icon}</span><span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Publishing..." : "Go Live 🚀"}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can edit everything from your dashboard after going live.
        </p>
      </div>
    </div>
  );
}
