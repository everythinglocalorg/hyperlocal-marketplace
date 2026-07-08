"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { renderMarkdown } from "@/lib/markdown";

type PostRow = {
  id: string; slug: string; title: string; category: string;
  is_published: boolean; published_at: string | null; view_count: number; author_name: string | null;
};

const CATEGORIES = [
  { value: "news", label: "News" },
  { value: "tips", label: "Tips" },
  { value: "highlight", label: "Business Highlight" },
  { value: "guide", label: "Guide" },
  { value: "other", label: "Other" },
];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export default function BlogAdminClient({ posts, defaultAuthorName, defaultAuthorAvatar }: {
  posts: PostRow[]; defaultAuthorName: string; defaultAuthorAvatar: string | null;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<PostRow[]>(posts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  function blankForm() {
    return {
      slug: "", title: "", excerpt: "", body: "", cover_image_url: "", category: "news",
      tags: "", seo_description: "", author_name: defaultAuthorName, author_title: "Everything Local Team",
      author_avatar_url: defaultAuthorAvatar ?? "", featured_vendor_slug: "", is_published: false,
    };
  }

  async function openEdit(id: string) {
    setError(null);
    const { data } = await supabase.from("blog_posts").select("*").eq("id", id).single();
    if (!data) return;
    setForm({
      slug: data.slug, title: data.title, excerpt: data.excerpt ?? "", body: data.body ?? "",
      cover_image_url: data.cover_image_url ?? "", category: data.category, tags: (data.tags ?? []).join(", "),
      seo_description: data.seo_description ?? "", author_name: data.author_name ?? "", author_title: data.author_title ?? "",
      author_avatar_url: data.author_avatar_url ?? "", featured_vendor_slug: data.featured_vendor_slug ?? "",
      is_published: data.is_published,
    });
    setEditingId(id); setCreating(false); setShowPreview(false);
  }

  function openNew() { setForm(blankForm()); setEditingId(null); setCreating(true); setShowPreview(false); setError(null); }

  async function save() {
    setError(null);
    if (!form.title.trim()) { setError("Title is required."); return; }
    const slug = form.slug.trim() || slugify(form.title);
    setSaving(true);
    const payload = {
      slug, title: form.title.trim(), excerpt: form.excerpt.trim() || null, body: form.body,
      cover_image_url: form.cover_image_url.trim() || null, category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      seo_description: form.seo_description.trim() || null,
      author_name: form.author_name.trim() || null, author_title: form.author_title.trim() || null,
      author_avatar_url: form.author_avatar_url.trim() || null,
      featured_vendor_slug: form.featured_vendor_slug.trim() || null,
      is_published: form.is_published,
      published_at: form.is_published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    let res;
    if (editingId) res = await supabase.from("blog_posts").update(payload).eq("id", editingId).select("id, slug, title, category, is_published, published_at, view_count, author_name").single();
    else res = await supabase.from("blog_posts").insert(payload).select("id, slug, title, category, is_published, published_at, view_count, author_name").single();
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    const row = res.data as PostRow;
    setRows((prev) => editingId ? prev.map((r) => r.id === row.id ? row : r) : [row, ...prev]);
    setEditingId(null); setCreating(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) { setEditingId(null); setCreating(false); }
  }

  const editing = creating || editingId;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-green-700">← Admin</Link>
          <h1 className="text-lg font-bold text-gray-900">Blog</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/blog" target="_blank" className="text-sm text-gray-500 hover:text-green-700">View blog ↗</Link>
          <button onClick={openNew} className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700">+ New post</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {editing ? (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">{editingId ? "Edit post" : "New post"}</h2>
                <button onClick={() => { setEditingId(null); setCreating(false); }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold" />
              <div className="flex gap-2">
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="url-slug" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="Cover image URL" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Excerpt (card summary + meta description)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={14} placeholder="Body (Markdown). Links: [text](https://url) — great for linking to a business you're highlighting." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-y" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} placeholder="Author name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={form.author_title} onChange={(e) => setForm({ ...form, author_title: e.target.value })} placeholder="Author title" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <input value={form.author_avatar_url} onChange={(e) => setForm({ ...form, author_avatar_url: e.target.value })} placeholder="Author avatar URL (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tags, comma, separated" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={form.featured_vendor_slug} onChange={(e) => setForm({ ...form, featured_vendor_slug: e.target.value })} placeholder="featured business slug (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <input value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} placeholder="SEO meta description (optional — overrides excerpt)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-green-600 w-4 h-4" />
                  Published (live on the site)
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setShowPreview((v) => !v)} className="text-sm border border-gray-200 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50">{showPreview ? "Hide preview" : "Preview"}</button>
                  <button onClick={save} disabled={saving} className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className={`bg-white rounded-2xl border border-gray-100 p-6 ${showPreview ? "" : "hidden lg:block"}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Preview</p>
              {form.cover_image_url && <img src={form.cover_image_url} alt="" className="w-full rounded-xl mb-4" />}
              <h1 className="text-2xl font-black text-gray-900 mb-4">{form.title || "Untitled"}</h1>
              <div className="text-[16px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.body || "*Nothing yet.*") }} />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {rows.length === 0 ? (
              <p className="text-center text-gray-400 py-16">No posts yet. Click “New post” to write your first.</p>
            ) : rows.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                    {r.is_published
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Published</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Draft</span>}
                  </div>
                  <p className="text-xs text-gray-400">/{r.slug} · {r.category} · {r.view_count} views</p>
                </div>
                <button onClick={() => openEdit(r.id)} className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">Edit</button>
                <button onClick={() => remove(r.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
