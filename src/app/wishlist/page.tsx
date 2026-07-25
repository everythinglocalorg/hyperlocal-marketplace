"use client";

import WishlistGrid from "@/components/WishlistGrid";

export default function WishlistPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-1">💚 Wish List</h1>
        <p className="text-sm text-gray-500 mb-6">Items you’ve saved to revisit or buy.</p>
        <WishlistGrid />
      </div>
    </main>
  );
}
