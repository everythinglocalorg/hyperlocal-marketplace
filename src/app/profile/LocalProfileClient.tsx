"use client";

import { useState } from "react";
import Link from "next/link";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import BusinessPicksManager, { type PickVendor } from "@/components/BusinessPicksManager";
import ProfileDetailsEditor, { normalizeDetails } from "@/components/ProfileDetailsEditor";

interface Props {
  profile: any;
  businessPicks: PickVendor[];
  profileDetails: any;
  ownedBusinessCount: number;
}

export default function LocalProfileClient({ profile, businessPicks, profileDetails, ownedBusinessCount }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [localProfile, setLocalProfile] = useState({
    full_name: profile.full_name as string | null,
    avatar_url: profile.avatar_url as string | null,
    phone: profile.phone as string | null,
  });

  const backHref = profile.role === "vendor" ? "/dashboard/vendor" : "/dashboard/buyer";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Focused header — back to dashboard, view public, same tab */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href={backHref} className="text-sm text-gray-500 hover:text-green-700 font-medium shrink-0">← Back to dashboard</Link>
          <span className="font-bold text-green-600 hidden sm:block">Local Profile</span>
          <Link href={`/u/${profile.id}`} className="text-sm font-semibold text-green-700 hover:underline shrink-0">View public →</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">⭐ Your Local Profile</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your public stamp of approval — the local businesses you stand behind, plus a bit about you. Share it to help great local spots get recognized.
        </p>

        {/* Photo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700 overflow-hidden shrink-0">
            {localProfile.avatar_url
              ? <img src={localProfile.avatar_url} alt="" className="w-full h-full object-cover" />
              : (localProfile.full_name ?? profile.email ?? "?")[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{localProfile.full_name ?? "Your name"}</p>
            <p className="text-xs text-gray-400">This photo shows at the top of your Local Profile.</p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="shrink-0 text-sm font-semibold border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:border-green-400 hover:text-green-700 transition-colors"
          >
            📷 Change photo
          </button>
        </div>

        <BusinessPicksManager userId={profile.id} engagedVendors={[]} initialPicks={businessPicks} />

        <ProfileDetailsEditor
          userId={profile.id}
          initial={normalizeDetails(profileDetails)}
          ownedBusinessCount={ownedBusinessCount}
        />
      </main>

      {showSettings && (
        <AccountSettingsModal
          profile={{ ...profile, full_name: localProfile.full_name, avatar_url: localProfile.avatar_url, phone: localProfile.phone }}
          onClose={() => setShowSettings(false)}
          onSaved={(u) => setLocalProfile(u)}
        />
      )}
    </div>
  );
}
