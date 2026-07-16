"use client";

// Static prototype — Local Loop + Ask Mike, Hiring, and Offers.
// Isolated at /local-pages-preview. Uses the live site's real Tailwind style.
// No data fetching, no backend, no shared imports. Safe to delete anytime.

import { useState } from "react";
import SearchSuggestions from "@/components/SearchSuggestions";
import { rememberSearch } from "@/lib/suggestions";

type TypeKey = "help" | "hiring" | "offer" | "general";

const TYPE_CONFIG: Record<TypeKey, { label: string; icon: string; color: string }> = {
  help: { label: "Ask", icon: "🙋", color: "bg-blue-100 text-blue-700" },
  hiring: { label: "Hiring", icon: "💼", color: "bg-green-100 text-green-700" },
  offer: { label: "Offer", icon: "🎟️", color: "bg-amber-100 text-amber-800" },
  general: { label: "General", icon: "💬", color: "bg-gray-100 text-gray-600" },
};

type Post = {
  id: string;
  type: TypeKey;
  name: string;
  initials: string;
  avatar: string;
  time: string;
  body: React.ReactNode;
};

const AVATAR_COLORS: Record<string, string> = {
  green: "bg-green-600",
  amber: "bg-amber-600",
  blue: "bg-cyan-600",
  purple: "bg-purple-600",
};

const POSTS: Post[] = [
  {
    id: "hiring",
    type: "hiring",
    name: "Rivertown Plumbing",
    initials: "RP",
    avatar: "green",
    time: "2d",
    body: (
      <>
        We&apos;re growing! Looking for an <strong>apprentice plumber</strong> — full-time, will
        train. $22–28/hr + benefits. Must be local to the Chippewa Valley. 👋
      </>
    ),
  },
  {
    id: "offer",
    type: "offer",
    name: "Maple & Main Café",
    initials: "MM",
    avatar: "amber",
    time: "5h",
    body: (
      <>
        New neighbors, welcome to the block. Book or order through Everything Local and take{" "}
        <strong>$25 off your first order</strong> — plus you&apos;ll earn Local Bucks on top. Valid
        through August. 🥞
      </>
    ),
  },
  {
    id: "ask",
    type: "help",
    name: "Dana K.",
    initials: "DK",
    avatar: "blue",
    time: "1d",
    body: <>Anyone know a reliable plumber for a leaky faucet? Third Ward area. Thanks neighbors!</>,
  },
  {
    id: "general",
    type: "general",
    name: "Chippewa Valley Farmers Market",
    initials: "FM",
    avatar: "purple",
    time: "3d",
    body: <>Market&apos;s back Saturday 8a–1p at Phoenix Park. Sweet corn is in. 🌽 See you there!</>,
  },
];

const MIKE_RESULTS = [
  { name: "Rivertown Plumbing", initials: "RP", color: "bg-green-600", meta: "★ 4.9 · open now · 0.8 mi", tier: "Local Pro+", cta: "Free estimate" },
  { name: "Foster & Sons", initials: "FS", color: "bg-cyan-600", meta: "★ 4.8 · open · 1.2 mi", tier: "Local Pro", cta: "Message" },
  { name: "Clearwater Repair", initials: "CR", color: "bg-purple-600", meta: "★ 4.7 · opens 8a · 2.0 mi", tier: "Verified local", cta: "Call" },
];

function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 text-[11px]" : "w-10 h-10 text-sm";
  return (
    <span className={`${dim} ${color} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>
      {initials}
    </span>
  );
}

export default function LocalPagesPreview() {
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [filter, setFilter] = useState<"all" | TypeKey>("all");

  function ask(text?: string) {
    const q = (text ?? query).trim();
    if (text !== undefined) setQuery(text);
    if (q) rememberSearch(q); // Mike learns it — next visit it shows as a 🕘 recent chip
    setAsked(q || "a local");
  }

  const visible = filter === "all" ? POSTS : POSTS.filter((p) => p.type === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sub-header (matches the real board) */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <span className="text-green-600">◈</span> Eau Claire, WI
            <span className="text-gray-400">▾</span>
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-1 rounded-full">Preview</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Board tabs */}
        <div className="flex gap-2 mb-4">
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white">
            🏘️ Local Loop
          </span>
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors cursor-pointer">
            💼 Local Jobs
          </span>
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors cursor-pointer">
            🌿 Explore
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-5">Local Loop in Eau Claire</h1>

        {/* Ask Mike concierge */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <Avatar initials="M" color="bg-green-600" />
            <div>
              <p className="text-[15px] font-semibold text-gray-900">Ask Mike</p>
              <p className="text-xs text-gray-500">Your local guide · finds you a trusted business fast</p>
            </div>
          </div>
          <p className="text-[17px] font-semibold text-gray-900 mb-3">What do you need today?</p>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-full pl-4 pr-1 py-1 focus-within:border-green-400 transition-colors">
              <span className="text-gray-400">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder='Try "plumber tonight", "flowers for mom"…'
                className="flex-1 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
              />
            </div>
            <button
              onClick={() => ask()}
              className="shrink-0 bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-green-700 transition-colors"
            >
              Ask Mike
            </button>
          </div>

          <SearchSuggestions
            citySlug="eau-claire-wi"
            cityLabel="Eau Claire"
            align="start"
            onPick={(term) => ask(term)}
          />

          {asked && (
            <div className="mt-4 space-y-2.5">
              <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <strong>Mike found 3 trusted locals for “{asked}”</strong> — ranked by neighbor reviews and distance.
              </div>
              {MIKE_RESULTS.map((r) => (
                <div key={r.name} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
                  <Avatar initials={r.initials} color={r.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                      <span className="text-[11px] font-semibold bg-green-100 text-green-800 border border-green-300 rounded-full px-2 py-0.5">
                        {r.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.meta}</p>
                  </div>
                  <button className="shrink-0 bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-green-700 transition-colors">
                    {r.cta}
                  </button>
                </div>
              ))}
              <button className="w-full text-sm font-semibold text-gray-600 border border-gray-200 rounded-full py-2.5 hover:bg-gray-50 transition-colors">
                See all businesses for “{asked}” →
              </button>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex gap-3">
            <Avatar initials="JD" color="bg-cyan-600" />
            <div className="flex-1">
              <p className="text-sm text-gray-400 py-2">What&apos;s on your mind? Tag people or businesses with @…</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(TYPE_CONFIG) as TypeKey[]).map((key) => (
                    <span
                      key={key}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        key === "help" ? "bg-green-100 text-green-800 border border-green-300" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {TYPE_CONFIG[key].icon} {TYPE_CONFIG[key].label}
                    </span>
                  ))}
                </div>
                <button className="ml-3 shrink-0 bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-green-700 transition-colors">
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {([["all", "All", ""], ...(Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label, v.icon]) as [string, string, string][])] as [string, string, string][]).map(
            ([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setFilter(key as "all" | TypeKey)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === key ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
                }`}
              >
                {icon && <span>{icon}</span>} {label}
              </button>
            )
          )}
        </div>

        {/* Feed */}
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-600 font-semibold mb-1">Nothing here yet</p>
            <p className="text-gray-400 text-sm">Try another filter, or be the first to post.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((post) => {
              const cfg = TYPE_CONFIG[post.type];
              return (
                <div
                  key={post.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                    post.type === "offer" ? "border-2 border-amber-200 ring-1 ring-amber-100" : "border-gray-100"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex gap-3">
                      <Avatar initials={post.initials} color={AVATAR_COLORS[post.avatar]} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{post.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{post.time} ago</span>
                        </div>

                        {post.type === "offer" && (
                          <p className="text-xl font-bold text-amber-700 mb-1">$25 off your first order</p>
                        )}

                        <div className="text-sm text-gray-700 leading-relaxed mb-3">{post.body}</div>

                        {/* Per-type actions */}
                        {post.type === "hiring" && (
                          <div className="flex gap-2 flex-wrap items-center">
                            <button className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-green-700 transition-colors">
                              Apply now
                            </button>
                            <button className="bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-50 transition-colors">
                              Message
                            </button>
                            <span className="text-xs text-gray-400 ml-auto">💚 12 neighbors interested</span>
                          </div>
                        )}

                        {post.type === "offer" && (
                          <div className="flex gap-2 flex-wrap items-center">
                            <button className="bg-amber-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-amber-700 transition-colors">
                              Claim offer
                            </button>
                            <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1.5">
                              ◔ Earns 25 Local Bucks
                            </span>
                          </div>
                        )}

                        {post.type === "help" && (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                            <Avatar initials="M" color="bg-green-600" size="sm" />
                            <span className="text-sm text-green-800">
                              <strong>Mike suggests:</strong> Rivertown Plumbing · ★4.9 · open now
                            </span>
                            <button className="ml-auto bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-green-700 transition-colors">
                              See
                            </button>
                          </div>
                        )}

                        {post.type === "general" && (
                          <div className="flex gap-4 text-xs text-gray-400">
                            <span className="hover:text-green-600 cursor-pointer">💚 High-five · 8</span>
                            <span className="hover:text-green-600 cursor-pointer">💬 Reply · 3</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Static prototype · existing style · /local-pages-preview · not wired to data
        </p>
      </div>
    </div>
  );
}
