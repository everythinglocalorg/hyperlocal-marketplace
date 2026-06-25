"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TYPE_CONFIG = {
  general:  { label: "General",         icon: "💬", color: "bg-gray-100 text-gray-600" },
  help:     { label: "Need Help",        icon: "🙋", color: "bg-blue-100 text-blue-700" },
  product:  { label: "Looking for Item", icon: "📦", color: "bg-amber-100 text-amber-700" },
  service:  { label: "Need a Service",   icon: "🔧", color: "bg-purple-100 text-purple-700" },
};

type Post = {
  id: string;
  title: string;
  body: string;
  type: string;
  city: string;
  state: string;
  created_at: string;
  author: { id: string; full_name: string | null; avatar_url: string | null } | null;
  tagged_vendor: { id: string; business_name: string; slug: string; logo_url: string | null } | null;
  response_count: { count: number }[];
};

type Vendor = { id: string; business_name: string; slug: string; logo_url: string | null; city: string; state: string };

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  posts: Post[];
  vendors: Vendor[];
  currentUser: { id: string; full_name: string | null; avatar_url: string | null; role: string } | null;
}

export default function CommunityBoardClient({ citySlug, cityName, stateCode, posts: initialPosts, vendors, currentUser }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [posts, setPosts] = useState(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null);

  // New post form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("general");
  const [taggedVendorId, setTaggedVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Response form per post
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [responseVendor, setResponseVendor] = useState<Record<string, string>>({});
  const [submittingResponse, setSubmittingResponse] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("all");

  const filteredPosts = filterType === "all" ? posts : posts.filter((p) => p.type === filterType);
  const filteredVendors = vendors.filter((v) =>
    vendorSearch.length < 2 ? false : v.business_name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) { router.push("/login"); return; }
    setSubmitting(true);

    const { data, error } = await supabase.from("community_posts").insert({
      user_id: currentUser.id,
      city_slug: citySlug,
      city: cityName,
      state: stateCode,
      title: title.trim(),
      body: body.trim(),
      type,
      tagged_vendor_id: taggedVendorId || null,
    }).select(`
      id, title, body, type, city, state, created_at,
      author:profiles!user_id(id, full_name, avatar_url),
      tagged_vendor:vendors(id, business_name, slug, logo_url),
      response_count:community_responses(count)
    `).single();

    if (!error && data) {
      setPosts((prev) => [data as any, ...prev]);
      setTitle(""); setBody(""); setType("general"); setTaggedVendorId(""); setVendorSearch("");
      setShowForm(false);
    }
    setSubmitting(false);
  }

  async function loadResponses(postId: string) {
    if (responses[postId]) { setExpandedPost(expandedPost === postId ? null : postId); return; }
    setLoadingResponses(postId);
    const { data } = await supabase
      .from("community_responses")
      .select("id, body, created_at, user:profiles!user_id(id, full_name, avatar_url), tagged_vendor:vendors(id, business_name, slug, logo_url)")
      .eq("post_id", postId)
      .order("created_at");
    setResponses((prev) => ({ ...prev, [postId]: data ?? [] }));
    setExpandedPost(postId);
    setLoadingResponses(null);
  }

  async function submitResponse(postId: string) {
    if (!currentUser) { router.push("/login"); return; }
    const text = responseText[postId]?.trim();
    if (!text) return;
    setSubmittingResponse(postId);

    const { data, error } = await supabase.from("community_responses").insert({
      post_id: postId,
      user_id: currentUser.id,
      body: text,
      tagged_vendor_id: responseVendor[postId] || null,
    }).select("id, body, created_at, user:profiles!user_id(id, full_name, avatar_url), tagged_vendor:vendors(id, business_name, slug, logo_url)").single();

    if (!error && data) {
      setResponses((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setResponseText((prev) => ({ ...prev, [postId]: "" }));
      setResponseVendor((prev) => ({ ...prev, [postId]: "" }));
      // Update count
      setPosts((prev) => prev.map((p) => p.id === postId
        ? { ...p, response_count: [{ count: (p.response_count?.[0]?.count ?? 0) + 1 }] }
        : p));
    }
    setSubmittingResponse(null);
  }

  function avatar(name: string | null, url: string | null, size = "w-8 h-8") {
    return (
      <div className={`${size} rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 shrink-0 overflow-hidden text-sm`}>
        {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : (name ?? "?")[0].toUpperCase()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-green-600 font-bold text-lg">HyperLocal</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">📍 {cityName}, {stateCode}</span>
          </div>
          <button
            onClick={() => { if (!currentUser) { router.push("/login"); return; } setShowForm(true); }}
            className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-green-700 transition-colors"
          >
            + Ask Neighbors
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Neighbor Board</h1>
          <p className="text-gray-500 text-sm mt-1">Ask for help, find products, or request services from people in {cityName}.</p>
        </div>

        {/* New post form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Post to Neighbor Board</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={submitPost} className="space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key} type="button"
                    onClick={() => setType(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      type === key ? "bg-green-50 border-green-400 text-green-800" : "border-gray-200 text-gray-600 hover:border-green-300"
                    }`}
                  >
                    <span>{cfg.icon}</span> {cfg.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                <input
                  type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                  placeholder={type === "help" ? "What do you need help with?" : type === "product" ? "What are you looking for?" : type === "service" ? "What service do you need?" : "What's on your mind?"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Details</label>
                <textarea
                  value={body} onChange={(e) => setBody(e.target.value)} rows={3} required
                  placeholder="Describe what you're looking for, any details, budget, timing..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              {/* Tag a vendor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tag a local business (optional)</label>
                <input
                  type="text" value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search business name..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {filteredVendors.length > 0 && (
                  <div className="mt-1 border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    {filteredVendors.slice(0, 5).map((v) => (
                      <button
                        key={v.id} type="button"
                        onClick={() => { setTaggedVendorId(v.id); setVendorSearch(v.business_name); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-green-50 transition-colors ${taggedVendorId === v.id ? "bg-green-50" : "bg-white"}`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs shrink-0 overflow-hidden">
                          {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-cover" /> : v.business_name[0]}
                        </div>
                        <span className="font-medium">{v.business_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{v.city}, {v.state}</span>
                      </button>
                    ))}
                  </div>
                )}
                {taggedVendorId && (
                  <button type="button" onClick={() => { setTaggedVendorId(""); setVendorSearch(""); }} className="text-xs text-red-500 mt-1 hover:underline">
                    Remove tag
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting || !title.trim() || !body.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors"
                >
                  {submitting ? "Posting..." : "Post to Board"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[["all","All Posts",""], ...Object.entries(TYPE_CONFIG).map(([k,v]) => [k, v.label, v.icon])].map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === key ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}
            >
              {icon && <span>{icon}</span>} {label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-600 font-semibold mb-1">No posts yet</p>
            <p className="text-gray-400 text-sm mb-4">Be the first to ask your neighbors something!</p>
            <button
              onClick={() => { if (!currentUser) { router.push("/login"); return; } setShowForm(true); }}
              className="bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-green-700 transition-colors"
            >
              Ask Your Neighbors
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const cfg = TYPE_CONFIG[post.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.general;
              const author = Array.isArray(post.author) ? post.author[0] : post.author;
              const tagged = Array.isArray(post.tagged_vendor) ? post.tagged_vendor[0] : post.tagged_vendor;
              const count = post.response_count?.[0]?.count ?? 0;
              const isExpanded = expandedPost === post.id;

              return (
                <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      {avatar(author?.full_name ?? null, author?.avatar_url ?? null)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-gray-900">{author?.full_name ?? "Neighbor"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-base mb-1">{post.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{post.body}</p>

                        {tagged && (
                          <Link href={`/vendors/${tagged.slug}`} className="inline-flex items-center gap-2 mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 hover:bg-green-100 transition-colors">
                            <div className="w-5 h-5 rounded bg-green-200 flex items-center justify-center text-xs font-bold text-green-800 overflow-hidden">
                              {tagged.logo_url ? <img src={tagged.logo_url} alt="" className="w-full h-full object-cover" /> : tagged.business_name[0]}
                            </div>
                            <span className="text-xs font-semibold text-green-800">@ {tagged.business_name}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Responses */}
                  <div className="border-t border-gray-50 px-5 py-3">
                    <button
                      onClick={() => loadResponses(post.id)}
                      className="text-sm text-gray-500 hover:text-green-700 font-medium transition-colors"
                    >
                      {loadingResponses === post.id ? "Loading..." : isExpanded ? "▲ Hide replies" : `💬 ${count} ${count === 1 ? "reply" : "replies"} — Click to ${count > 0 ? "view" : "respond"}`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {/* Existing responses */}
                      {(responses[post.id] ?? []).map((r) => {
                        const ru = Array.isArray(r.user) ? r.user[0] : r.user;
                        const rv = Array.isArray(r.tagged_vendor) ? r.tagged_vendor[0] : r.tagged_vendor;
                        return (
                          <div key={r.id} className="flex gap-3 px-5 py-3 border-b border-gray-50 last:border-b-0">
                            {avatar(ru?.full_name ?? null, ru?.avatar_url ?? null, "w-7 h-7")}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-800">{ru?.full_name ?? "Neighbor"}</span>
                                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-gray-700">{r.body}</p>
                              {rv && (
                                <Link href={`/vendors/${rv.slug}`} className="inline-flex items-center gap-1.5 mt-1 text-xs text-green-700 font-semibold hover:underline">
                                  @ {rv.business_name}
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Reply form */}
                      {currentUser ? (
                        <div className="px-5 py-4 bg-gray-50">
                          <textarea
                            value={responseText[post.id] ?? ""}
                            onChange={(e) => setResponseText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write a reply or recommendation..."
                            rows={2}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none bg-white mb-2"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitResponse(post.id)}
                              disabled={submittingResponse === post.id || !responseText[post.id]?.trim()}
                              className="bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                              {submittingResponse === post.id ? "Posting..." : "Reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-3 bg-gray-50 text-center">
                          <Link href="/login" className="text-sm text-green-600 font-medium hover:underline">Log in to reply</Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
