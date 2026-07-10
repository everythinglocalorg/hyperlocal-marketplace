"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useFavorites } from "@/lib/favorites";
import { formatPrice } from "@/lib/utils";

type Item = {
  id: string; title: string; price: number | null; price_label: string | null;
  images: string[] | null; vendor: any;
};

export default function WishlistPage() {
  const supabase = createClient();
  const { ready, userId, savedIds, toggleWishlist } = useFavorites();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const ids = [...savedIds];
    if (!userId || ids.length === 0) { setItems([]); setLoading(false); return; }
    supabase
      .from("listings")
      .select("id, title, price, price_label, images, vendor:vendors(slug, business_name)")
      .in("id", ids)
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
    // Load once when favorites are ready; removals update `items` locally below.
  }, [ready, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id: string) {
    await toggleWishlist(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-1">💚 Wish List</h1>
        <p className="text-sm text-gray-500 mb-6">Items you’ve saved to revisit or buy.</p>

        {!ready || loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : !userId ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">💚</p>
            <p className="text-gray-600 mb-4">Log in to save items to your wish list.</p>
            <Link href="/login" className="inline-block bg-green-600 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-green-700 transition-colors">Log in</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3 opacity-40">💚</p>
            <p className="text-gray-500">Your wish list is empty.</p>
            <p className="text-xs text-gray-400 mt-1">Tap the heart on any item to save it here.</p>
            <Link href="/search" className="inline-block mt-4 text-sm text-green-600 font-semibold hover:underline">Browse local →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((it) => {
              const v = Array.isArray(it.vendor) ? it.vendor[0] : it.vendor;
              const priceLabel = it.price != null ? formatPrice(it.price) : it.price_label;
              return (
                <div key={it.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
                  <Link href={v?.slug ? `/vendors/${v.slug}` : "#"} className="block relative aspect-square bg-gray-100">
                    {it.images?.[0]
                      ? <img src={it.images[0]} alt={it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <span className="w-full h-full flex items-center justify-center text-4xl text-gray-300">📦</span>}
                    <button
                      onClick={(e) => { e.preventDefault(); remove(it.id); }}
                      aria-label="Remove from wish list"
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                    </button>
                  </Link>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{it.title}</p>
                    {priceLabel && <p className="text-sm font-bold text-green-700 mt-0.5">{priceLabel}</p>}
                    {v?.business_name && <p className="text-xs text-gray-400 mt-0.5 truncate">{v.business_name}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
