"use client";

import { useFavorites, Top8Vendor } from "@/lib/favorites";

// Add/remove a business from your Top 8 favorites (quick access in the site
// menu). Favoriting also follows the business. Full at 8.
export default function Top8Button({ vendor, className = "" }: { vendor: Top8Vendor; className?: string }) {
  const { isTop8, toggleTop8 } = useFavorites();
  const active = isTop8(vendor.vendorId);

  async function onClick() {
    const res = await toggleTop8(vendor);
    if (res === "login") window.location.href = "/login";
    else if (res === "full") alert("Your Top 8 is full — remove a favorite first, then add this one.");
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border transition-colors ${
        active ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100" : "border-gray-300 text-gray-700 hover:bg-gray-50"
      } ${className}`}
    >
      <span>{active ? "★" : "☆"}</span>
      {active ? "In your Top 8" : "Add to Top 8"}
    </button>
  );
}
