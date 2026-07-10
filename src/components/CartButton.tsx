"use client";

import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

// Floating cart pill — appears on any page once the cart has items. The many
// page-specific headers make a single header slot unreliable, so this lives
// globally (in the root layout) and opens the shared CartDrawer.
export default function CartButton() {
  const { count, subtotal, open } = useCart();
  if (count === 0) return null;
  return (
    <button
      onClick={open}
      aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed z-40 bottom-20 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 bg-gray-900 text-white font-bold pl-4 pr-5 py-3 rounded-full shadow-xl hover:bg-gray-800 active:scale-95 transition-all"
    >
      <span className="relative text-lg leading-none">
        🛒
        <span className="absolute -top-2.5 -right-2.5 bg-green-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{count}</span>
      </span>
      <span className="text-sm">{formatPrice(subtotal)}</span>
    </button>
  );
}
