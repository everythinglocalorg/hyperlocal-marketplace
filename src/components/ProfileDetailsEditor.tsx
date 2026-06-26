"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Position = { title: string; org: string };
export type ProfileDetails = {
  show: { positions: boolean; businesses: boolean; achievements: boolean; ask: boolean };
  positions: Position[];
  achievements: string[];
  ask: string;
};

export const EMPTY_DETAILS: ProfileDetails = {
  show: { positions: false, businesses: false, achievements: false, ask: false },
  positions: [],
  achievements: [],
  ask: "",
};

// Merge stored (possibly partial) jsonb into a full shape.
export function normalizeDetails(raw: any): ProfileDetails {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    show: {
      positions: !!d.show?.positions,
      businesses: !!d.show?.businesses,
      achievements: !!d.show?.achievements,
      ask: !!d.show?.ask,
    },
    positions: Array.isArray(d.positions) ? d.positions.filter((p: any) => p && typeof p === "object") : [],
    achievements: Array.isArray(d.achievements) ? d.achievements.filter((a: any) => typeof a === "string") : [],
    ask: typeof d.ask === "string" ? d.ask : "",
  };
}

interface Props {
  userId: string;
  initial: ProfileDetails;
  ownedBusinessCount: number;
}

function SectionToggle({ on, onToggle, label, hint }: { on: boolean; onToggle: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
        on ? "border-green-300 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${on ? "bg-green-500" : "bg-gray-200"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-4" : "left-0.5"}`} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="block text-xs text-gray-400">{hint}</span>
      </span>
    </button>
  );
}

export default function ProfileDetailsEditor({ userId, initial, ownedBusinessCount }: Props) {
  const supabase = createClient();
  const [d, setD] = useState<ProfileDetails>(initial);
  const [saved, setSaved] = useState<ProfileDetails>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(d) !== JSON.stringify(saved);

  function toggle(key: keyof ProfileDetails["show"]) {
    setD((prev) => ({ ...prev, show: { ...prev.show, [key]: !prev.show[key] } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    // Trim empties so we don't store junk.
    const clean: ProfileDetails = {
      show: d.show,
      positions: d.positions.filter((p) => p.title.trim() || p.org.trim()),
      achievements: d.achievements.map((a) => a.trim()).filter(Boolean),
      ask: d.ask.trim(),
    };
    const { error: err } = await supabase.from("profiles").update({ profile_details: clean }).eq("id", userId);
    if (err) setError(err.message);
    else { setD(clean); setSaved(clean); }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">About You</h2>
        <p className="text-xs text-gray-400 mt-0.5">Flip on the boxes you want to show. Empty ones stay hidden.</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Toggles */}
        <div className="grid sm:grid-cols-2 gap-2">
          <SectionToggle on={d.show.positions} onToggle={() => toggle("positions")} label="🏷️ Positions / Roles" hint="Owner, board member, etc." />
          <SectionToggle on={d.show.businesses} onToggle={() => toggle("businesses")} label="🏢 Businesses Owned" hint={`${ownedBusinessCount} verified from your account`} />
          <SectionToggle on={d.show.achievements} onToggle={() => toggle("achievements")} label="🏆 Achievements" hint="Milestones & recognition" />
          <SectionToggle on={d.show.ask} onToggle={() => toggle("ask")} label="🙋 My Ask for the Community" hint="What you're looking for" />
        </div>

        {/* Positions */}
        {d.show.positions && (
          <div className="border-t border-gray-50 pt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Positions / Roles</label>
            <div className="space-y-2">
              {d.positions.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input value={p.title} onChange={(e) => setD((prev) => ({ ...prev, positions: prev.positions.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                    placeholder="Title (e.g. Owner)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={p.org} onChange={(e) => setD((prev) => ({ ...prev, positions: prev.positions.map((x, j) => j === i ? { ...x, org: e.target.value } : x) }))}
                    placeholder="Where (e.g. Burr Hauling)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button onClick={() => setD((prev) => ({ ...prev, positions: prev.positions.filter((_, j) => j !== i) }))}
                    className="w-9 shrink-0 rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setD((prev) => ({ ...prev, positions: [...prev.positions, { title: "", org: "" }] }))}
              className="mt-2 text-sm text-green-600 font-medium hover:underline">+ Add a role</button>
          </div>
        )}

        {/* Businesses owned (auto) */}
        {d.show.businesses && (
          <div className="border-t border-gray-50 pt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Businesses Owned</label>
            <p className="text-xs text-gray-400">
              {ownedBusinessCount > 0
                ? `Your ${ownedBusinessCount} verified business${ownedBusinessCount === 1 ? "" : "es"} will show automatically — no need to type them.`
                : "You don't have any businesses on your account yet. Create one and it'll appear here automatically."}
            </p>
          </div>
        )}

        {/* Achievements */}
        {d.show.achievements && (
          <div className="border-t border-gray-50 pt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Achievements</label>
            <div className="space-y-2">
              {d.achievements.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input value={a} onChange={(e) => setD((prev) => ({ ...prev, achievements: prev.achievements.map((x, j) => j === i ? e.target.value : x) }))}
                    placeholder="e.g. 10 years serving Eau Claire" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button onClick={() => setD((prev) => ({ ...prev, achievements: prev.achievements.filter((_, j) => j !== i) }))}
                    className="w-9 shrink-0 rounded-xl text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setD((prev) => ({ ...prev, achievements: [...prev.achievements, ""] }))}
              className="mt-2 text-sm text-green-600 font-medium hover:underline">+ Add an achievement</button>
          </div>
        )}

        {/* Community ask */}
        {d.show.ask && (
          <div className="border-t border-gray-50 pt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">My Ask for the Community</label>
            <p className="text-xs text-gray-400 mb-2">What are you looking for? A service, a hire, a referral, a connection.</p>
            <textarea value={d.ask} onChange={(e) => setD((prev) => ({ ...prev, ask: e.target.value }))} rows={2}
              placeholder="e.g. Looking for a reliable local web designer — referrals welcome!"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-gray-50 pt-4">
          <button onClick={save} disabled={!dirty || saving}
            className="bg-gray-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? "Saving…" : dirty ? "Save about-you" : "Saved ✓"}
          </button>
          {dirty && !saving && <span className="text-xs text-amber-600">Unsaved changes</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
