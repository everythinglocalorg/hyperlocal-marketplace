import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ShareProfileButton from "./ShareProfileButton";

interface Props {
  params: Promise<{ id: string }>;
}

type PickVendor = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  city: string;
  state: string;
  tier: string;
  is_verified: boolean;
  rating: number;
};

async function loadProfile(id: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, city, state, created_at")
    .eq("id", id)
    .single();

  if (!profile) return null;

  const { data: rawPicks } = await supabase
    .from("profile_business_picks")
    .select("position, vendor:vendors(id, business_name, slug, logo_url, category, city, state, tier, is_verified, rating, is_active)")
    .eq("user_id", id)
    .order("position");

  const picks: PickVendor[] = (rawPicks ?? [])
    .map((row) => (Array.isArray(row.vendor) ? row.vendor[0] : row.vendor))
    .filter((v): v is PickVendor & { is_active: boolean } => Boolean(v) && (v as { is_active?: boolean }).is_active !== false);

  const { data: { user } } = await supabase.auth.getUser();

  return { profile, picks, isOwner: user?.id === id };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadProfile(id);
  const name = data?.profile.full_name ?? "A neighbor";
  return {
    title: `${name}'s Local Picks — Everything Local`,
    description: `See the local businesses ${name} loves and supports on Everything Local.`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const data = await loadProfile(id);
  if (!data) notFound();

  const { profile, picks, isOwner } = data;
  const displayName = profile.full_name ?? "A neighbor";
  const memberSince = profile.created_at ? new Date(profile.created_at).getFullYear() : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-green-600">Everything Local</Link>
          <Link href="/search" className="text-sm text-gray-500 hover:text-green-700 font-medium">Discover businesses →</Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-24 h-24 rounded-full bg-white/15 ring-4 ring-white/20 flex items-center justify-center text-4xl font-bold overflow-hidden shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : displayName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-green-100 text-sm mt-1">
              {profile.city ? `📍 ${profile.city}${profile.state ? `, ${profile.state}` : ""}` : "Supporting local"}
              {memberSince ? ` · Local since ${memberSince}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
              <ShareProfileButton />
              {isOwner && (
                <Link
                  href="/dashboard/buyer?tab=profile"
                  className="inline-flex items-center gap-2 bg-white text-green-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-50 transition-colors"
                >
                  ✏️ Edit my picks
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top 8 board */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h2 className="text-lg font-bold text-gray-900">{displayName.split(" ")[0]}'s Top 8 Local Picks</h2>
          </div>
          <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
            {picks.length}/8 spots
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-5">
          The local businesses {isOwner ? "you vouch" : `${displayName.split(" ")[0]} vouches`} for. A personal stamp of trust for the community.
        </p>

        {/* Always render all 8 slots — empty ones show the frame so it fills up over time */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => {
            const v = picks[i];
            const isTop = i === 0;

            // Empty slot
            if (!v) {
              const EmptySlot = (
                <div
                  className={`relative h-full min-h-[150px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-3 transition-colors ${
                    isOwner ? "border-green-200 bg-green-50/40 hover:border-green-400 hover:bg-green-50 cursor-pointer" : "border-gray-200 bg-gray-50/60"
                  }`}
                >
                  <span className="absolute top-2 left-2.5 text-xs font-bold text-gray-300">{isTop ? "👑" : `#${i + 1}`}</span>
                  <span className="text-2xl text-gray-300">{isOwner ? "＋" : "☆"}</span>
                  {isOwner && <span className="text-[11px] font-medium text-green-700 mt-1">Add a favorite</span>}
                </div>
              );
              return isOwner ? (
                <Link key={`empty-${i}`} href="/dashboard/buyer?tab=profile" className="block h-full">{EmptySlot}</Link>
              ) : (
                <div key={`empty-${i}`} className="h-full">{EmptySlot}</div>
              );
            }

            // Filled slot
            return (
              <Link
                key={v.id}
                href={`/vendors/${v.slug}`}
                className={`group relative bg-white rounded-2xl border shadow-sm p-3 flex flex-col items-center text-center hover:shadow-md transition-all ${
                  isTop ? "border-amber-200 ring-1 ring-amber-100" : "border-gray-100 hover:border-green-200"
                }`}
              >
                <span className="absolute top-2 left-2.5 text-xs font-bold text-gray-300">{isTop ? "👑" : `#${i + 1}`}</span>
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center font-bold text-xl text-green-700 overflow-hidden mb-2 mt-1">
                  {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" /> : v.business_name[0]?.toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-green-700 transition-colors">
                  {v.business_name}
                  {v.is_verified && <span className="ml-1 text-blue-500" title="Verified">✓</span>}
                </p>
                <p className="text-[11px] text-gray-400 truncate w-full mt-0.5">{v.category}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                  {v.rating > 0 && <span className="text-[11px] font-medium text-gray-600">★ {v.rating.toFixed(1)}</span>}
                  {v.tier === "premium" && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Pro</span>}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Credibility / CTA footer */}
        {picks.length === 0 && !isOwner && (
          <p className="text-center text-sm text-gray-400 mt-6">{displayName.split(" ")[0]} hasn't picked their Top 8 yet — check back soon.</p>
        )}
        {isOwner && picks.length < 8 && (
          <div className="mt-6 text-center">
            <Link href="/dashboard/buyer?tab=profile" className="inline-block bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors">
              {picks.length === 0 ? "Choose your Top 8 →" : `Fill your remaining ${8 - picks.length} ${8 - picks.length === 1 ? "spot" : "spots"} →`}
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Powered by <Link href="/" className="text-green-600 hover:underline">Everything Local</Link> — support local, earn Local Bucks.
        </p>
      </main>
    </div>
  );
}
