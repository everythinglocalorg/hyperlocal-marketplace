"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Two per-user favorites features:
//  • Wish List — saved listings (green heart). DB: wishlist_items.
//  • Top 8 — favorite businesses for quick access. DB: top8_businesses.
// Adding a business to your Top 8 also follows it (follows table); following
// alone does NOT add to Top 8.

export type Top8Vendor = { vendorId: string; name: string; slug: string; logoUrl: string | null };
type ToggleResult = "login" | "added" | "removed" | "full";

type FavoritesValue = {
  ready: boolean;
  userId: string | null;
  savedIds: Set<string>;
  wishlistCount: number;
  top8: Top8Vendor[];
  isSaved: (listingId: string) => boolean;
  isTop8: (vendorId: string) => boolean;
  toggleWishlist: (listingId: string) => Promise<ToggleResult>;
  toggleTop8: (v: Top8Vendor) => Promise<ToggleResult>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);
const MAX_TOP8 = 8;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [top8, setTop8] = useState<Top8Vendor[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return;
      if (!user) { setReady(true); return; }
      setUserId(user.id);
      const [{ data: wl }, { data: t8 }] = await Promise.all([
        supabase.from("wishlist_items").select("listing_id").eq("user_id", user.id),
        supabase.from("top8_businesses").select("vendor_id, position, vendors(business_name, slug, logo_url)").eq("user_id", user.id).order("position"),
      ]);
      if (cancelled) return;
      setSavedIds(new Set((wl ?? []).map((r: any) => r.listing_id)));
      setTop8((t8 ?? []).map((r: any) => {
        const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
        return { vendorId: r.vendor_id, name: v?.business_name ?? "Business", slug: v?.slug ?? "", logoUrl: v?.logo_url ?? null };
      }).filter((x: Top8Vendor) => x.slug));
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [supabase]);

  const toggleWishlist = useCallback(async (listingId: string): Promise<ToggleResult> => {
    if (!userId) return "login";
    const has = savedIds.has(listingId);
    // optimistic
    setSavedIds((prev) => { const n = new Set(prev); has ? n.delete(listingId) : n.add(listingId); return n; });
    if (has) {
      await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("listing_id", listingId);
      return "removed";
    }
    await supabase.from("wishlist_items").insert({ user_id: userId, listing_id: listingId });
    return "added";
  }, [supabase, userId, savedIds]);

  const toggleTop8 = useCallback(async (v: Top8Vendor): Promise<ToggleResult> => {
    if (!userId) return "login";
    const has = top8.some((x) => x.vendorId === v.vendorId);
    if (has) {
      setTop8((prev) => prev.filter((x) => x.vendorId !== v.vendorId));
      await supabase.from("top8_businesses").delete().eq("user_id", userId).eq("vendor_id", v.vendorId);
      return "removed";
    }
    if (top8.length >= MAX_TOP8) return "full";
    const position = top8.length;
    setTop8((prev) => [...prev, v]);
    await supabase.from("top8_businesses").insert({ user_id: userId, vendor_id: v.vendorId, position });
    // Favoriting a business also follows it (ignore duplicate-follow errors).
    await supabase.from("follows").insert({ follower_id: userId, target_type: "vendor", target_id: v.vendorId });
    return "added";
  }, [supabase, userId, top8]);

  return (
    <FavoritesContext.Provider value={{
      ready, userId, savedIds, wishlistCount: savedIds.size, top8,
      isSaved: (id) => savedIds.has(id),
      isTop8: (id) => top8.some((x) => x.vendorId === id),
      toggleWishlist, toggleTop8,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
