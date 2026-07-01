"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SEED_CITIES, makeSlug, type CityOption } from "@/lib/cities";

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

  const current = cities.find(c => c.slug === value);

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
          const slug = makeSlug(row.city.trim(), row.state.trim());
          if (!seen.has(slug)) {
            seen.add(slug);
            merged.push({
              slug,
              label: `${row.city.trim()}, ${row.state.trim().toUpperCase()}`,
              city: row.city.trim(),
              state: row.state.trim().toUpperCase(),
            });
          }
        }

        merged.sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
        setCities(merged);
      });
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Group cities by state
  const states = [...new Set(cities.map(c => c.state))].sort();

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
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 w-56 overflow-hidden max-h-80 overflow-y-auto">
          <div className="p-1">
            {states.map(state => (
              <div key={state}>
                <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">{state}</p>
                {cities.filter(c => c.state === state).map(c => (
                  <button
                    key={c.slug}
                    onClick={() => { onChange(c.slug, c); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${
                      value === c.slug
                        ? "bg-green-50 text-green-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {c.city}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {onRadiusChange && radius !== undefined && (
            <div className="border-t border-gray-100 p-3 sticky bottom-0 bg-white">
              <p className="text-xs font-medium text-gray-500 mb-2">Search radius</p>
              <div className="flex gap-1">
                {RADIUS_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => onRadiusChange(r)}
                    className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
                      radius === r
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
