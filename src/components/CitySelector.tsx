"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SEED_CITIES, makeSlug, normalizeState, resolveCity, type CityOption } from "@/lib/cities";

const RADIUS_OPTIONS = [10, 25, 50, 100];

interface Props {
  value: string;
  onChange: (slug: string, city: CityOption) => void;
  radius?: number;
  onRadiusChange?: (r: number) => void;
}

export default function CitySelector({ value, onChange, radius, onRadiusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<CityOption[]>(SEED_CITIES);
  const ref = useRef<HTMLDivElement>(null);

  // Fall back to parsing the slug so towns without vendors still show their name
  const current = cities.find(c => c.slug === value) ?? resolveCity(value);
  const states = [...new Set(cities.map(c => c.state))].sort();

  // Derive selected state from current city; default to first state
  const [selectedState, setSelectedState] = useState<string>(() =>
    current?.state ?? states[0] ?? ""
  );

  const citiesInState = cities.filter(c => c.state === selectedState);

  // Fetch distinct cities from active vendors and merge with seed cities
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("vendors")
      .select("city, state")
      .eq("is_active", true)
      .not("city", "is", null)
      .not("state", "is", null)
      .then(({ data }) => {
        const seen = new Set(SEED_CITIES.map(c => c.slug));
        const merged: CityOption[] = [...SEED_CITIES];
        for (const row of (data ?? [])) {
          if (!row.city?.trim() || !row.state?.trim()) continue;
          const stateAbbr = normalizeState(row.state.trim());
          const slug = makeSlug(row.city.trim(), stateAbbr);
          if (!seen.has(slug)) {
            seen.add(slug);
            merged.push({
              slug,
              label: `${row.city.trim()}, ${stateAbbr}`,
              city: row.city.trim(),
              state: stateAbbr,
            });
          }
        }
        merged.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
        setCities(merged);
      });
  }, []);

  // Keep selectedState in sync if value changes externally
  useEffect(() => {
    if (current?.state && current.state !== selectedState) {
      setSelectedState(current.state);
    }
  }, [current?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleStateChange(state: string) {
    setSelectedState(state);
    // Auto-select first city in new state
    const first = cities.find(c => c.state === state);
    if (first) onChange(first.slug, first);
  }

  function handleCityChange(slug: string) {
    const cityObj = cities.find(c => c.slug === slug);
    if (cityObj) onChange(slug, cityObj);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-full text-sm font-medium hover:bg-green-100 transition-colors whitespace-nowrap"
      >
        <span>📍</span>
        <span>{current?.label ?? "Select city"}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 w-screen max-w-xs sm:w-64 p-4 space-y-3" style={{ maxWidth: "min(16rem, calc(100vw - 1rem))" }}>
          {/* State dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {states.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* City dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
            <select
              value={value}
              onChange={(e) => { handleCityChange(e.target.value); setOpen(false); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {citiesInState.map(c => (
                <option key={c.slug} value={c.slug}>{c.city}</option>
              ))}
            </select>
          </div>

          {/* Radius */}
          {onRadiusChange && radius !== undefined && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Search radius</p>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => onRadiusChange(r)}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      radius === r ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {r}mi
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
