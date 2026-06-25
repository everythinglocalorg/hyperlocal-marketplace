"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LAUNCH_CITIES, CATEGORIES } from "@/types";
import { getBrowserLocation, reverseGeocode, geocodeQuery } from "@/lib/geocode";

const STEPS = [
  { id: 1, label: "Your Location" },
  { id: 2, label: "Interests" },
  { id: 3, label: "You're In!" },
];

type LocationState = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  displayName: string;
} | null;

export default function BuyerOnboardingClient() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<LocationState>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  function toggleInterest(cat: string) {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function detectLocation() {
    setLocLoading(true);
    setLocError(null);
    try {
      const pos = await getBrowserLocation();
      const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (geo) {
        setLocation({
          city: geo.city,
          state: geo.state,
          latitude: geo.latitude,
          longitude: geo.longitude,
          displayName: geo.displayName,
        });
        setShowManual(false);
      } else {
        setLocError("Couldn't identify your location. Try searching below.");
        setShowManual(true);
      }
    } catch {
      setLocError("Location access denied. Search for your city below.");
      setShowManual(true);
    } finally {
      setLocLoading(false);
    }
  }

  async function searchLocation() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setLocError(null);
    const geo = await geocodeQuery(searchQuery);
    if (geo) {
      setLocation({
        city: geo.city,
        state: geo.state,
        latitude: geo.latitude,
        longitude: geo.longitude,
        displayName: geo.displayName,
      });
    } else {
      setLocError("Couldn't find that location. Try a city name or ZIP code.");
    }
    setSearchLoading(false);
  }

  function selectLaunchCity(city: typeof LAUNCH_CITIES[0]) {
    setLocation({
      city: city.name,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      displayName: `${city.name}, ${city.state}`,
    });
  }

  async function handleFinish() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    await supabase.from("profiles").update({ phone: phone || null }).eq("id", user.id);

    if (phone) {
      await supabase.rpc("award_local_bucks", {
        p_user_id: user.id,
        p_amount: 5,
        p_reason: "add_phone",
      });
    }

    // Build search URL with detected location
    let destination = "/search";
    if (location) {
      const params = new URLSearchParams({
        lat: location.latitude.toString(),
        lng: location.longitude.toString(),
        city: location.city,
        state: location.state,
        radius: "25",
      });
      destination = `/search?${params.toString()}`;
    }

    router.push(destination);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-xl font-bold text-green-600">Everything Local</span>
          <span className="text-sm text-gray-500">Step {step} of {STEPS.length}</span>
        </div>
      </div>
      <div className="bg-white h-1.5">
        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-amber-400 text-white rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <span className="text-2xl">🪙</span>
          <div>
            <p className="font-bold text-sm">You earned 10 Local Bucks!</p>
            <p className="text-xs opacity-90">Welcome bonus — just for signing up.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">

          {/* STEP 1 — Location */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">📍</div>
                <h1 className="text-2xl font-bold text-gray-900">Where are you?</h1>
                <p className="text-gray-500 text-sm mt-1">
                  We'll show you local vendors wherever you are — any city, any state.
                </p>
              </div>

              {/* Detected location display */}
              {location && (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">📍</span>
                    <div>
                      <p className="font-semibold text-green-800 text-sm">{location.displayName}</p>
                      <p className="text-xs text-green-600">Location set</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLocation(null); setShowManual(true); }}
                    className="text-xs text-green-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Detect via GPS */}
              {!location && (
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locLoading}
                  className="w-full flex items-center justify-center gap-3 bg-green-600 text-white rounded-xl py-3.5 text-sm font-semibold hover:bg-green-700 transition-colors mb-4 disabled:opacity-60"
                >
                  {locLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-base">📡</span>
                  )}
                  {locLoading ? "Detecting location..." : "Use my current location"}
                </button>
              )}

              {/* Divider */}
              {!location && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-gray-400">or search any city</span>
                  </div>
                </div>
              )}

              {/* City search */}
              {(!location || showManual) && (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchLocation()}
                    placeholder="City name or ZIP code..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={searchLocation}
                    disabled={searchLoading || !searchQuery.trim()}
                    className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
                  >
                    {searchLoading ? "..." : "Search"}
                  </button>
                </div>
              )}

              {locError && (
                <p className="text-xs text-red-600 mb-4">{locError}</p>
              )}

              {/* Launch city quick-picks */}
              {!location && (
                <>
                  <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Or pick a launch city</p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {LAUNCH_CITIES.map((city) => (
                      <button
                        key={city.slug}
                        type="button"
                        onClick={() => selectLaunchCity(city)}
                        className="p-3 rounded-xl border-2 border-gray-200 text-left hover:border-green-400 hover:bg-green-50 transition-all"
                      >
                        <p className="font-semibold text-gray-900 text-sm">{city.name}</p>
                        <p className="text-xs text-gray-500">{city.state}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone number <span className="text-gray-400 font-normal">(optional — earn +5 Local Bucks)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(715) 555-0100"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2 — Interests */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <div className="text-3xl mb-2">❤️</div>
                <h1 className="text-2xl font-bold text-gray-900">What are you into?</h1>
                <p className="text-gray-500 text-sm mt-1">
                  We'll surface the best local vendors in your area for the things you care about.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleInterest(cat)}
                    className={`p-3 rounded-xl border-2 text-sm text-left transition-all ${
                      interests.includes(cat)
                        ? "border-green-500 bg-green-50 text-green-700 font-medium"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {interests.includes(cat) ? "✓ " : ""}{cat}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">
                {interests.length === 0 ? "Pick at least one to personalize your feed" : `${interests.length} selected`}
              </p>
            </div>
          )}

          {/* STEP 3 — Welcome */}
          {step === 3 && (
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
              {location && (
                <p className="text-green-600 font-medium text-sm mb-1">📍 Showing vendors near {location.displayName}</p>
              )}
              <p className="text-gray-500 text-sm mb-8">Start discovering amazing local vendors in your community.</p>
              <div className="grid grid-cols-1 gap-3 mb-8 text-left">
                {[
                  { icon: "🪙", title: "10 Local Bucks in your wallet", desc: "Use them to boost vendors you love" },
                  { icon: "⭐", title: "Earn 5 LB for every review", desc: "Help your community discover great businesses" },
                  { icon: "🤝", title: "Earn 50 LB per referral", desc: "Share with friends and earn big rewards" },
                  { icon: "🛍️", title: "Earn 25 LB on first purchase", desc: "Shop local and get rewarded" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && step < 3 && (
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
                className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                {step === 1 && !location ? "Skip for now" : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Start Exploring →"}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          You can update your location anytime from your profile.
        </p>
      </div>
    </div>
  );
}
