"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LS_CITY_KEY } from "@/lib/cities";
import CitySelector from "@/components/CitySelector";

const TYPE_CONFIG = {
  general:  { label: "General",         icon: "💬", color: "bg-gray-100 text-gray-600" },
  help:     { label: "Need Help",        icon: "🙋", color: "bg-blue-100 text-blue-700" },
  product:  { label: "Looking for Item", icon: "📦", color: "bg-amber-100 text-amber-700" },
  service:  { label: "Need a Service",   icon: "🔧", color: "bg-purple-100 text-purple-700" },
  hiring:   { label: "Hiring",           icon: "💼", color: "bg-green-100 text-green-700" },
  offer:    { label: "Offer",            icon: "🎟️", color: "bg-amber-100 text-amber-800" },
};

// Business-only post types, billed $5/mo via Stripe (same fee as Local Jobs).
const PAID_TYPES = ["hiring", "offer"];

// The reply action doubles as "apply" on hiring posts and "claim" on offers.
function replyLabel(type: string, count: number): string {
  if (type === "hiring") return count > 0 ? `${count} ${count === 1 ? "Applicant" : "Applicants"}` : "Apply";
  if (type === "offer") return count > 0 ? `${count} Claimed` : "Claim offer";
  return `${count} ${count === 1 ? "Reply" : "Replies"}`;
}

const FLAG_REASONS = ["Spam", "Inappropriate", "Wrong location", "Duplicate", "Other"];

type Mention = { type: "profile" | "vendor"; id: string; label: string; slug?: string | null; ownerId?: string | null };

type Post = {
  id: string;
  title: string;
  body: string;
  type: string;
  city: string;
  state: string;
  created_at: string;
  mentions?: Mention[];
  author: { id: string; full_name: string | null; avatar_url: string | null } | null;
  tagged_vendor: { id: string; business_name: string; slug: string; logo_url: string | null } | null;
  response_count: { count: number }[];
  highfive_count: { count: number }[];
};

type Vendor = { id: string; business_name: string; slug: string; logo_url: string | null; city: string; state: string };

interface Props {
  citySlug: string;
  cityName: string;
  stateCode: string;
  posts: Post[];
  vendors: Vendor[];
  currentUser: { id: string; full_name: string | null; avatar_url: string | null; role: string } | null;
  currentVendor: { id: string; business_name: string; slug: string } | null;
  myHighfives: string[];
  flaggedIds: { post_id: string | null; response_id: string | null }[];
}

export default function CommunityBoardClient({
  citySlug, cityName, stateCode,
  posts: initialPosts, vendors, currentUser, currentVendor,
  myHighfives: initialHighfives, flaggedIds,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const isAdmin = currentUser?.role === "admin";
  const canPostPaid = !!currentVendor;
  const [postError, setPostError] = useState<string | null>(null);
  // Post-payment return banner (Stripe redirects back with ?posted / ?post_cancelled).
  const [payToast, setPayToast] = useState<null | "posted" | "cancelled">(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("posted") === "1") setPayToast("posted");
    else if (p.has("post_cancelled")) setPayToast("cancelled");
    if (p.has("posted") || p.has("post_cancelled")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Switch towns — browse any town's board (travelers, nearby areas)
  function switchCity(slug: string) {
    if (slug === citySlug) return;
    localStorage.setItem(LS_CITY_KEY, slug);
    if (currentUser) {
      supabase.from("profiles").update({ default_city: slug }).eq("id", currentUser.id).then(() => {});
    }
    router.push(`/community/${slug}`);
  }

  const [posts, setPosts] = useState(initialPosts);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any[]>>({});
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null);

  // Paid "Local Loop" boosts — featured products & businesses pinned to the top.
  const [featured, setFeatured] = useState<{ id: string; slug: string; title: string; image: string | null; kind: "listing" | "vendor" }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: boosts } = await supabase
        .from("featured_boosts")
        .select("entity_type, entity_id")
        .eq("placement", "local_pages")
        .eq("is_active", true)
        .eq("city_slug", citySlug);
      if (!boosts?.length) return;
      const listingIds = boosts.filter((b) => b.entity_type === "listing").map((b) => b.entity_id);
      const vendorIds = boosts.filter((b) => b.entity_type === "vendor").map((b) => b.entity_id);
      const out: { id: string; slug: string; title: string; image: string | null; kind: "listing" | "vendor" }[] = [];
      if (listingIds.length) {
        const { data } = await supabase.from("listings").select("id, title, images, vendor:vendors(slug)").in("id", listingIds).eq("is_active", true);
        for (const l of data ?? []) {
          const v = Array.isArray(l.vendor) ? l.vendor[0] : l.vendor;
          if (v?.slug) out.push({ id: l.id, slug: v.slug, title: l.title, image: l.images?.[0] ?? null, kind: "listing" });
        }
      }
      if (vendorIds.length) {
        const { data } = await supabase.from("vendors").select("id, business_name, slug, logo_url").in("id", vendorIds).eq("is_active", true);
        for (const v of data ?? []) {
          if (v.slug) out.push({ id: v.id, slug: v.slug, title: v.business_name, image: v.logo_url, kind: "vendor" });
        }
      }
      setFeatured(out);
    })();
  }, [supabase, citySlug]);

  // High fives
  const [highfived, setHighfived] = useState<Set<string>>(new Set(initialHighfives));
  const [highfiveCounts, setHighfiveCounts] = useState<Record<string, number>>(
    Object.fromEntries(initialPosts.map((p) => [p.id, p.highfive_count?.[0]?.count ?? 0]))
  );

  // Flags
  const flaggedPostIds = new Set(flaggedIds.filter((f) => f.post_id).map((f) => f.post_id!));
  const flaggedResponseIds = new Set(flaggedIds.filter((f) => f.response_id).map((f) => f.response_id!));
  const [flagModal, setFlagModal] = useState<{ type: "post" | "response"; id: string } | null>(null);
  const [flagReason, setFlagReason] = useState("Spam");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [myFlags, setMyFlags] = useState<Set<string>>(new Set());

  // Inline post composer — single textarea
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // @ mentions (people + businesses)
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mentionAnchor = useRef<number>(-1);
  const [mentionResults, setMentionResults] = useState<Mention[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [postMentions, setPostMentions] = useState<Mention[]>([]);

  async function handleComposerChange(value: string, caret: number) {
    setPostText(value);
    const upToCaret = value.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    // @ must start the text or follow whitespace
    if (at === -1 || (at > 0 && !/\s/.test(upToCaret[at - 1]))) { setMentionOpen(false); return; }
    const query = upToCaret.slice(at + 1);
    if (query.includes("\n") || query.length > 30) { setMentionOpen(false); return; }
    const q = query.trim();
    if (q.length < 1) { setMentionOpen(false); return; }
    mentionAnchor.current = at;

    const [{ data: people }, { data: biz }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").ilike("full_name", `%${q}%`).not("full_name", "is", null).limit(4),
      supabase.from("vendors").select("id, business_name, slug, user_id").eq("is_active", true).ilike("business_name", `%${q}%`).limit(4),
    ]);
    const results: Mention[] = [
      ...(people ?? []).map((p: any) => ({ type: "profile" as const, id: p.id, label: p.full_name as string })),
      ...(biz ?? []).map((v: any) => ({ type: "vendor" as const, id: v.id, label: v.business_name as string, slug: v.slug, ownerId: v.user_id })),
    ];
    setMentionResults(results);
    setMentionOpen(results.length > 0);
  }

  function selectMention(m: Mention) {
    const el = composerRef.current;
    const at = mentionAnchor.current;
    if (!el || at < 0) return;
    const caret = el.selectionStart;
    const inserted = `@${m.label} `;
    const newText = postText.slice(0, at) + inserted + postText.slice(caret);
    setPostText(newText);
    setPostMentions((prev) => [...prev.filter((x) => !(x.type === m.type && x.id === m.id)), m]);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = at + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Render a body with @mentions turned into links.
  function renderBody(body: string, mentions?: Mention[]) {
    const ms = (mentions ?? []).filter((m) => m?.label);
    if (ms.length === 0) return body;
    const sorted = [...ms].sort((a, b) => b.label.length - a.label.length);
    const escaped = sorted.map((m) => `@${m.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    const re = new RegExp(`(${escaped.join("|")})`, "g");
    return body.split(re).map((part, i) => {
      const m = sorted.find((mm) => `@${mm.label}` === part);
      if (!m) return <span key={i}>{part}</span>;
      const href = m.type === "profile" ? `/u/${m.id}` : `/vendors/${m.slug ?? ""}`;
      return <Link key={i} href={href} className="text-green-700 font-semibold hover:underline">{part}</Link>;
    });
  }

  // Response form per post
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [responseVendorSearch, setResponseVendorSearch] = useState<Record<string, string>>({});
  const [responseVendorId, setResponseVendorId] = useState<Record<string, string>>({});
  const [submittingResponse, setSubmittingResponse] = useState<string | null>(null);

  // @ mentions in replies (one active dropdown at a time, keyed by post)
  const replyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const replyAnchor = useRef<number>(-1);
  const [replyMentions, setReplyMentions] = useState<Record<string, Mention[]>>({});
  const [replyMentionState, setReplyMentionState] = useState<{ postId: string; results: Mention[] } | null>(null);

  async function handleReplyChange(postId: string, value: string, caret: number) {
    setResponseText((prev) => ({ ...prev, [postId]: value }));
    const upToCaret = value.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at === -1 || (at > 0 && !/\s/.test(upToCaret[at - 1]))) { setReplyMentionState(null); return; }
    const query = upToCaret.slice(at + 1);
    if (query.includes("\n") || query.length > 30) { setReplyMentionState(null); return; }
    const q = query.trim();
    if (q.length < 1) { setReplyMentionState(null); return; }
    replyAnchor.current = at;
    const [{ data: people }, { data: biz }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").ilike("full_name", `%${q}%`).not("full_name", "is", null).limit(4),
      supabase.from("vendors").select("id, business_name, slug, user_id").eq("is_active", true).ilike("business_name", `%${q}%`).limit(4),
    ]);
    const results: Mention[] = [
      ...(people ?? []).map((p: any) => ({ type: "profile" as const, id: p.id, label: p.full_name as string })),
      ...(biz ?? []).map((v: any) => ({ type: "vendor" as const, id: v.id, label: v.business_name as string, slug: v.slug, ownerId: v.user_id })),
    ];
    setReplyMentionState(results.length ? { postId, results } : null);
  }

  function selectReplyMention(postId: string, m: Mention) {
    const el = replyRefs.current[postId];
    const at = replyAnchor.current;
    const current = responseText[postId] ?? "";
    const caret = el ? el.selectionStart : current.length;
    const inserted = `@${m.label} `;
    const newText = current.slice(0, at) + inserted + current.slice(caret);
    setResponseText((prev) => ({ ...prev, [postId]: newText }));
    setReplyMentions((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []).filter((x) => !(x.type === m.type && x.id === m.id)), m] }));
    setReplyMentionState(null);
    requestAnimationFrame(() => {
      if (el) { el.focus(); const pos = at + inserted.length; el.setSelectionRange(pos, pos); }
    });
  }

  const filteredPosts = filterType === "all" ? posts : posts.filter((p) => p.type === filterType);

  function getVendorSuggestions(search: string) {
    if (search.length < 2) return [];
    return vendors.filter((v) => v.business_name.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
  }

  // ── High Five ────────────────────────────────────────────────
  async function toggleHighfive(postId: string) {
    if (!currentUser) { router.push("/login"); return; }
    const already = highfived.has(postId);
    setHighfived((prev) => { const s = new Set(prev); already ? s.delete(postId) : s.add(postId); return s; });
    setHighfiveCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + (already ? -1 : 1) }));
    if (already) {
      await supabase.from("community_post_highfives").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    } else {
      await supabase.from("community_post_highfives").insert({ post_id: postId, user_id: currentUser.id });
    }
  }

  // ── Flag ─────────────────────────────────────────────────────
  async function submitFlag() {
    if (!currentUser || !flagModal) return;
    setFlagSubmitting(true);
    await supabase.from("community_flags").insert({
      user_id: currentUser.id,
      post_id: flagModal.type === "post" ? flagModal.id : null,
      response_id: flagModal.type === "response" ? flagModal.id : null,
      reason: flagReason,
    });
    setMyFlags((prev) => new Set([...prev, flagModal.id]));
    setFlagModal(null);
    setFlagSubmitting(false);
  }

  // ── Admin Delete ──────────────────────────────────────────────
  async function adminDeletePost(postId: string) {
    if (!confirm("Delete this post and all its replies?")) return;
    const post = posts.find((p) => p.id === postId);
    // Paid posts (Hiring / Offer) go through the server so the $5/mo sub is canceled.
    if (post && PAID_TYPES.includes(post.type)) {
      try {
        const res = await fetch("/api/local-pages/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        });
        if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
        else alert("Could not delete post. Please try again.");
      } catch {
        alert("Could not delete post. Please try again.");
      }
      return;
    }
    const { error } = await supabase.from("community_posts").delete().eq("id", postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      alert("Could not delete post. Please try again.");
    }
  }

  async function adminDeleteResponse(postId: string, responseId: string) {
    if (!confirm("Delete this reply?")) return;
    await supabase.from("community_responses").delete().eq("id", responseId);
    setResponses((prev) => ({ ...prev, [postId]: (prev[postId] ?? []).filter((r) => r.id !== responseId) }));
  }

  // ── Post submit ───────────────────────────────────────────────
  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) { router.push("/login"); return; }
    const text = postText.trim();
    if (!text) return;
    const isPaid = PAID_TYPES.includes(postType);
    if (isPaid && !currentVendor) { setPostError("Only businesses can post this."); return; }
    setPostError(null);
    setSubmitting(true);

    // Only keep mentions whose @label still appears in the final text.
    const finalMentions = postMentions.filter((m) => text.includes(`@${m.label}`));
    const mentionsJson = finalMentions.map((m) => ({ type: m.type, id: m.id, label: m.label, slug: m.slug ?? null }));

    const { data, error } = await supabase.from("community_posts").insert({
      user_id: currentUser.id,
      city_slug: citySlug,
      city: cityName,
      state: stateCode,
      title: text.slice(0, 120),
      body: text,
      type: postType,
      is_active: !isPaid, // paid posts stay hidden until the $5/mo checkout clears
      mentions: mentionsJson,
    }).select("id, title, body, type, city, state, created_at, user_id, mentions").single();

    if (!error && data) {
      // Business Hiring / Offer: draft created inactive — send to Stripe to publish.
      if (isPaid) {
        try {
          const res = await fetch("/api/local-pages/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_id: data.id }),
          });
          const out = await res.json();
          if (out.url) { window.location.href = out.url; return; }
          setPostError(out.error ?? "Could not start checkout. Please try again.");
        } catch {
          setPostError("Could not reach checkout. Please try again.");
        }
        // Checkout didn't start — clean up the orphaned draft so it doesn't linger.
        await supabase.from("community_posts").delete().eq("id", data.id);
        setSubmitting(false);
        return;
      }

      // Record the mention graph + notify tagged parties (best-effort).
      if (finalMentions.length) {
        supabase.from("community_mentions").insert(
          finalMentions.map((m) => ({ post_id: data.id, author_id: currentUser.id, target_type: m.type, target_id: m.id }))
        ).then(() => {});

        const notifs = finalMentions
          .map((m) => {
            const recipient = m.type === "profile" ? m.id : m.ownerId;
            if (!recipient || recipient === currentUser.id) return null;
            return {
              user_id: recipient,
              actor_id: currentUser.id,
              type: "mention",
              title: `${currentUser.full_name ?? "Someone"} tagged you in ${cityName}`,
              body: text.slice(0, 140),
              link: `/community/${citySlug}`,
            };
          })
          .filter(Boolean);
        if (notifs.length) {
          notifs.forEach((n: any) => {
            supabase.rpc("create_notification", {
              p_user_id: n.user_id, p_actor_id: n.actor_id,
              p_type: n.type, p_title: n.title, p_body: n.body, p_link: n.link,
            }).then(() => {});
          });
        }
      }

      const newPost: any = {
        ...data,
        author: { id: currentUser.id, full_name: currentUser.full_name, avatar_url: currentUser.avatar_url },
        tagged_vendor: null,
        response_count: [{ count: 0 }],
        highfive_count: [{ count: 0 }],
      };
      setPosts((prev) => [newPost, ...prev]);
      setHighfiveCounts((prev) => ({ ...prev, [newPost.id]: 0 }));
      setPostText("");
      setPostType("general");
      setPostMentions([]);
      setMentionOpen(false);
    }
    setSubmitting(false);
  }

  // ── Responses ─────────────────────────────────────────────────
  async function loadResponses(postId: string) {
    if (responses[postId]) { setExpandedPost(expandedPost === postId ? null : postId); return; }
    setLoadingResponses(postId);
    const { data } = await supabase
      .from("community_responses")
      .select("id, body, created_at, mentions, user:profiles!user_id(id, full_name, avatar_url), tagged_vendor:vendors(id, business_name, slug, logo_url)")
      .eq("post_id", postId).order("created_at");
    setResponses((prev) => ({ ...prev, [postId]: data ?? [] }));
    setExpandedPost(postId);
    setLoadingResponses(null);
  }

  async function submitResponse(postId: string) {
    if (!currentUser) { router.push("/login"); return; }
    const text = responseText[postId]?.trim();
    if (!text) return;
    setSubmittingResponse(postId);
    const finalMentions = (replyMentions[postId] ?? []).filter((m) => text.includes(`@${m.label}`));
    const mentionsJson = finalMentions.map((m) => ({ type: m.type, id: m.id, label: m.label, slug: m.slug ?? null }));

    const { data, error } = await supabase.from("community_responses").insert({
      post_id: postId,
      user_id: currentUser.id,
      body: text,
      tagged_vendor_id: responseVendorId[postId] || null,
      mentions: mentionsJson,
    }).select("id, body, created_at, mentions, user:profiles!user_id(id, full_name, avatar_url), tagged_vendor:vendors(id, business_name, slug, logo_url)").single();

    if (!error && data) {
      if (finalMentions.length) {
        supabase.from("community_mentions").insert(
          finalMentions.map((m) => ({ post_id: postId, author_id: currentUser.id, target_type: m.type, target_id: m.id }))
        ).then(() => {});
        const notifs = finalMentions
          .map((m) => {
            const recipient = m.type === "profile" ? m.id : m.ownerId;
            if (!recipient || recipient === currentUser.id) return null;
            return { user_id: recipient, actor_id: currentUser.id, type: "mention", title: `${currentUser.full_name ?? "Someone"} tagged you in a reply`, body: text.slice(0, 140), link: `/community/${citySlug}` };
          })
          .filter(Boolean);
        if (notifs.length) {
          notifs.forEach((n: any) => {
            supabase.rpc("create_notification", {
              p_user_id: n.user_id, p_actor_id: n.actor_id,
              p_type: n.type, p_title: n.title, p_body: n.body, p_link: n.link,
            }).then(() => {});
          });
        }
      }

      setResponses((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data] }));
      setResponseText((prev) => ({ ...prev, [postId]: "" }));
      setResponseVendorSearch((prev) => ({ ...prev, [postId]: "" }));
      setResponseVendorId((prev) => ({ ...prev, [postId]: "" }));
      setReplyMentions((prev) => ({ ...prev, [postId]: [] }));
      setPosts((prev) => prev.map((p) => p.id === postId
        ? { ...p, response_count: [{ count: (p.response_count?.[0]?.count ?? 0) + 1 }] } : p));
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

      {/* Flag modal */}
      {flagModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFlagModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Report {flagModal.type}</h3>
            <p className="text-sm text-gray-500 mb-4">Why are you flagging this?</p>
            <div className="space-y-2 mb-5">
              {FLAG_REASONS.map((r) => (
                <label key={r} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${
                  flagReason === r ? "bg-red-50 border-red-400 text-red-800" : "border-gray-200 text-gray-700 hover:border-red-300"
                }`}>
                  <input type="radio" name="flag" value={r} checked={flagReason === r} onChange={() => setFlagReason(r)} className="accent-red-500" />
                  {r}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setFlagModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submitFlag} disabled={flagSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors">
                {flagSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-header (sits below the global header) */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <CitySelector value={citySlug} onChange={(slug) => switchCity(slug)} />
          {isAdmin && <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-full">Admin</span>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Return from Stripe Checkout */}
        {payToast === "posted" && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-800">
            🎉 Your post is live on Local Loop. Thanks for supporting local.
          </div>
        )}
        {payToast === "cancelled" && (
          <div className="mb-5 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600">
            Checkout cancelled — your post wasn&apos;t published and you weren&apos;t charged.
          </div>
        )}

        {/* Board tabs — siblings: Local Loop, Local Jobs, Explore */}
        <div className="flex gap-2 mb-4">
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-green-600 text-white">
            🏘️ Local Loop
          </span>
          <Link href={`/jobs/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            💼 Local Jobs
          </Link>
          <Link href={`/explore/${citySlug}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors">
            🌿 Explore
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-5">
          Local Loop in {cityName}
        </h1>

        {/* Featured locally — paid Local Loop boosts */}
        {featured.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">🚀 Featured locally</p>
            <div className="flex gap-3 overflow-x-auto flex-nowrap scrollbar-hide pb-1">
              {featured.map((f) => (
                <Link key={f.id} href={`/vendors/${f.slug}`}
                  className="shrink-0 w-32 bg-white rounded-2xl border-2 border-amber-200 ring-1 ring-amber-100 overflow-hidden hover:shadow-md transition-all">
                  <div className="w-full h-20 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {f.image
                      ? <img src={f.image} alt={f.title} loading="lazy" decoding="async" className={`w-full h-full ${f.kind === "vendor" ? "object-contain p-2" : "object-cover"}`} />
                      : <span className="text-2xl text-gray-300">{f.kind === "vendor" ? "🏪" : "📦"}</span>}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">{f.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Inline composer */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          {currentUser ? (
            <form onSubmit={submitPost}>
              <div className="flex gap-3">
                {avatar(currentUser.full_name, currentUser.avatar_url)}
                <div className="flex-1">
                  <textarea
                    ref={composerRef}
                    value={postText}
                    onChange={(e) => handleComposerChange(e.target.value, e.target.selectionStart)}
                    onKeyUp={(e) => handleComposerChange((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
                    placeholder="What's on your mind? Tag people or businesses with @…"
                    rows={3}
                    className="w-full text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
                  />

                  {/* @ mention autocomplete */}
                  {mentionOpen && mentionResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                      {mentionResults.map((m) => (
                        <button
                          type="button"
                          key={`${m.type}-${m.id}`}
                          onClick={() => selectMention(m)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors"
                        >
                          <span>{m.type === "vendor" ? "🏢" : "👤"}</span>
                          <span className="font-medium text-gray-800 truncate">{m.label}</span>
                          <span className="ml-auto text-xs text-gray-400 shrink-0">{m.type === "vendor" ? "Business" : "Person"}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    {/* Type pills — Hiring / Offer are business-only paid posts */}
                    <div className="flex gap-1.5 flex-wrap">
                      {Object.entries(TYPE_CONFIG)
                        .filter(([key]) => canPostPaid || !PAID_TYPES.includes(key))
                        .map(([key, cfg]) => (
                        <button key={key} type="button" onClick={() => setPostType(key)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            postType === key ? "bg-green-100 text-green-800 border border-green-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}>
                          {cfg.icon} {cfg.label}
                        </button>
                      ))}
                    </div>
                    <button type="submit" disabled={submitting || !postText.trim()}
                      className="ml-3 shrink-0 bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-green-700 disabled:opacity-40 transition-colors whitespace-nowrap">
                      {submitting
                        ? (PAID_TYPES.includes(postType) ? "Starting checkout…" : "Posting...")
                        : (PAID_TYPES.includes(postType) ? "Continue — $5/mo →" : "Post")}
                    </button>
                  </div>
                  {PAID_TYPES.includes(postType) && (
                    <p className="text-xs text-gray-500 mt-2">
                      {postType === "hiring"
                        ? "Business post · $5/mo · goes live after payment and also posts to Local Jobs."
                        : "Business post · $5/mo · goes live after payment. Cancel anytime by deleting it."}
                    </p>
                  )}
                  {postError && <p className="text-xs text-red-600 mt-2">{postError}</p>}
                </div>
              </div>
            </form>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 mb-2">Join the conversation in {cityName}</p>
              <Link href="/login" className="bg-green-600 text-white text-sm font-semibold px-6 py-2 rounded-full hover:bg-green-700 transition-colors inline-block">
                Log in to post
              </Link>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[["all","All",""], ...Object.entries(TYPE_CONFIG).map(([k,v]) => [k, v.label, v.icon])].map(([key, label, icon]) => (
            <button key={key} onClick={() => setFilterType(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === key ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
              }`}>
              {icon && <span>{icon}</span>} {label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-600 font-semibold mb-1">No posts yet</p>
            <p className="text-gray-400 text-sm">Be the first to post on your town&apos;s Local Loop!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const cfg = TYPE_CONFIG[post.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.general;
              const author = Array.isArray(post.author) ? post.author[0] : post.author;
              const replyCount = post.response_count?.[0]?.count ?? 0;
              const hfCount = highfiveCounts[post.id] ?? 0;
              const iHfed = highfived.has(post.id);
              const isExpanded = expandedPost === post.id;
              const isFlagged = flaggedPostIds.has(post.id);
              const vendorSearch = responseVendorSearch[post.id] ?? "";
              const vendorSuggestions = getVendorSuggestions(vendorSearch);

              return (
                <div key={post.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isFlagged && isAdmin ? "border border-red-200" : post.type === "offer" ? "border-2 border-amber-200 ring-1 ring-amber-100" : "border border-gray-100"}`}>
                  <div className="p-4">
                    {isAdmin && isFlagged && (
                      <div className="text-xs text-red-600 font-semibold bg-red-50 rounded-lg px-3 py-1.5 mb-3">🚩 Flagged by community</div>
                    )}

                    <div className="flex gap-3">
                      {avatar(author?.full_name ?? null, author?.avatar_url ?? null)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{author?.full_name ?? "Neighbor"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{renderBody(post.body, post.mentions)}</p>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                      <button onClick={() => toggleHighfive(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all select-none ${
                          iHfed ? "bg-amber-100 text-amber-700 scale-105" : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
                        }`}>
                        🙌 {hfCount > 0 ? hfCount : ""} High Five{hfCount !== 1 ? "s" : ""}
                      </button>

                      <button onClick={() => loadResponses(post.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          post.type === "hiring" || post.type === "offer"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "text-gray-500 bg-gray-100 hover:bg-green-50 hover:text-green-700"
                        }`}>
                        {post.type === "hiring" ? "💼" : post.type === "offer" ? "🎟️" : "💬"} {replyLabel(post.type, replyCount)}
                      </button>

                      <div className="ml-auto flex items-center gap-2">
                        {currentUser && !myFlags.has(post.id) && (
                          <button onClick={() => setFlagModal({ type: "post", id: post.id })} title="Report"
                            className="text-xs text-gray-300 hover:text-red-400 px-1 transition-colors">🚩</button>
                        )}
                        {myFlags.has(post.id) && <span className="text-xs text-gray-300 italic">Reported</span>}
                        {(isAdmin || currentUser?.id === author?.id) && (
                          <button onClick={() => adminDeletePost(post.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {(responses[post.id] ?? []).map((r) => {
                        const ru = Array.isArray(r.user) ? r.user[0] : r.user;
                        const rv = Array.isArray(r.tagged_vendor) ? r.tagged_vendor[0] : r.tagged_vendor;
                        const rFlagged = flaggedResponseIds.has(r.id);
                        return (
                          <div key={r.id} className={`flex gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 ${rFlagged && isAdmin ? "bg-red-50" : ""}`}>
                            {avatar(ru?.full_name ?? null, ru?.avatar_url ?? null, "w-7 h-7")}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-800">{ru?.full_name ?? "Neighbor"}</span>
                                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                {isAdmin && rFlagged && <span className="text-xs text-red-500 font-semibold">🚩</span>}
                                <div className="ml-auto flex gap-2">
                                  {currentUser && !myFlags.has(r.id) && (
                                    <button onClick={() => setFlagModal({ type: "response", id: r.id })} title="Report"
                                      className="text-xs text-gray-300 hover:text-red-400 transition-colors">🚩</button>
                                  )}
                                  {(isAdmin || currentUser?.id === ru?.id) && (
                                    <button onClick={() => adminDeleteResponse(post.id, r.id)}
                                      className="text-xs text-red-500 hover:text-red-700 font-semibold">Delete</button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderBody(r.body, r.mentions)}</p>
                              {rv && (
                                <Link href={`/vendors/${rv.slug}`} className="inline-flex items-center gap-1.5 mt-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-100 transition-colors">
                                  <div className={`w-4 h-4 rounded flex items-center justify-center text-xs font-bold text-green-800 overflow-hidden ${rv.logo_url ? "bg-white" : "bg-green-200"}`}>
                                    {rv.logo_url ? <img src={rv.logo_url} alt="" className="w-full h-full object-contain" /> : rv.business_name[0]}
                                  </div>
                                  <span className="text-xs font-semibold text-green-800">@ {rv.business_name}</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Reply form */}
                      {currentUser ? (
                        <div className="px-4 py-3 bg-gray-50">
                          <div className="flex gap-2">
                            {avatar(currentUser.full_name, currentUser.avatar_url, "w-7 h-7")}
                            <div className="flex-1">
                              <div className="relative">
                                <textarea
                                  ref={(el) => { replyRefs.current[post.id] = el; }}
                                  value={responseText[post.id] ?? ""}
                                  onChange={(e) => handleReplyChange(post.id, e.target.value, e.target.selectionStart)}
                                  onKeyUp={(e) => handleReplyChange(post.id, (e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
                                  placeholder="Reply… tag people or businesses with @"
                                  rows={2}
                                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none bg-white"
                                />
                                {replyMentionState?.postId === post.id && replyMentionState.results.length > 0 && (
                                  <div className="absolute left-0 right-0 top-full mt-1 z-30 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                                    {replyMentionState.results.map((m) => (
                                      <button type="button" key={`${m.type}-${m.id}`} onMouseDown={(e) => { e.preventDefault(); selectReplyMention(post.id, m); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors">
                                        <span>{m.type === "vendor" ? "🏢" : "👤"}</span>
                                        <span className="font-medium text-gray-800 truncate">{m.label}</span>
                                        <span className="ml-auto text-xs text-gray-400 shrink-0">{m.type === "vendor" ? "Business" : "Person"}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Vendor tag in reply */}
                              <div className="mt-1.5">
                                <input
                                  type="text"
                                  value={vendorSearch}
                                  onChange={(e) => setResponseVendorSearch((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                  placeholder="@ Tag a local business (optional)"
                                  className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                />
                                {vendorSuggestions.length > 0 && (
                                  <div className="mt-0.5 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                                    {vendorSuggestions.map((v) => (
                                      <button key={v.id} type="button"
                                        onClick={() => {
                                          setResponseVendorId((prev) => ({ ...prev, [post.id]: v.id }));
                                          setResponseVendorSearch((prev) => ({ ...prev, [post.id]: v.business_name }));
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-green-50 transition-colors">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center font-bold text-green-700 text-xs shrink-0 overflow-hidden ${v.logo_url ? "bg-white border border-gray-100" : "bg-green-100"}`}>
                                          {v.logo_url ? <img src={v.logo_url} alt="" className="w-full h-full object-contain" /> : v.business_name[0]}
                                        </div>
                                        <span className="font-medium">{v.business_name}</span>
                                        <span className="text-gray-400 ml-auto">{v.city}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {responseVendorId[post.id] && (
                                  <button type="button"
                                    onClick={() => { setResponseVendorId((p) => ({ ...p, [post.id]: "" })); setResponseVendorSearch((p) => ({ ...p, [post.id]: "" })); }}
                                    className="text-xs text-red-400 hover:underline mt-0.5">Remove tag</button>
                                )}
                              </div>

                              <button onClick={() => submitResponse(post.id)}
                                disabled={submittingResponse === post.id || !responseText[post.id]?.trim()}
                                className="mt-2 bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-green-700 disabled:opacity-40 transition-colors">
                                {submittingResponse === post.id ? "Posting..." : "Reply"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 text-center">
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
