"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

// A multi-store shopping cart, persisted to localStorage. Each store keeps its
// OWN cart (keyed by vendor id), so starting a cart in one shop and then adding
// from another no longer wipes the first — you build and keep a separate cart
// per store and check each one out on its own (each vendor's payments / pickup
// run through that store). Totals in the floating button aggregate every store.

export type CartItem = { listingId: string; title: string; price: number; image: string | null; qty: number; porchPickup?: boolean; localDrop?: boolean; pickupInfo?: string | null; dropInfo?: string | null };
export type CartVendor = { id: string; name: string; slug: string; pickupInfo?: string | null; dropInfo?: string | null };
export type StoreCart = { vendor: CartVendor; items: CartItem[] };
type CartState = { carts: Record<string, StoreCart> };

type CartContextValue = {
  carts: StoreCart[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (vendor: CartVendor, item: Omit<CartItem, "qty">, qty?: number) => "added";
  // Kept for call-site compatibility; now just adds to that store's cart.
  startNewCart: (vendor: CartVendor, item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (vendorId: string, listingId: string, qty: number) => void;
  removeItem: (vendorId: string, listingId: string) => void;
  clearStore: (vendorId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const LS_KEY = "el_cart_v2";
const LS_KEY_LEGACY = "el_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ carts: {} });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setState(JSON.parse(raw));
      } else {
        // One-time migration from the old single-store cart.
        const legacy = localStorage.getItem(LS_KEY_LEGACY);
        if (legacy) {
          const old = JSON.parse(legacy) as { vendor: CartVendor | null; items: CartItem[] };
          if (old?.vendor && old.items?.length) {
            setState({ carts: { [old.vendor.id]: { vendor: old.vendor, items: old.items } } });
          }
          localStorage.removeItem(LS_KEY_LEGACY);
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  }, [state, hydrated]);

  const addItem = useCallback((vendor: CartVendor, item: Omit<CartItem, "qty">, qty = 1): "added" => {
    setState((s) => {
      const existing = s.carts[vendor.id];
      const items = existing ? [...existing.items] : [];
      const idx = items.findIndex((x) => x.listingId === item.listingId);
      if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + qty };
      else items.push({ ...item, qty });
      return { carts: { ...s.carts, [vendor.id]: { vendor, items } } };
    });
    return "added";
  }, []);

  // No more cross-store conflict — this is now just an add.
  const startNewCart = useCallback((vendor: CartVendor, item: Omit<CartItem, "qty">, qty = 1) => {
    addItem(vendor, item, qty);
  }, [addItem]);

  const setQty = useCallback((vendorId: string, listingId: string, qty: number) => {
    setState((s) => {
      const c = s.carts[vendorId];
      if (!c) return s;
      const items = c.items.map((x) => x.listingId === listingId ? { ...x, qty: Math.max(1, qty) } : x);
      return { carts: { ...s.carts, [vendorId]: { ...c, items } } };
    });
  }, []);

  const removeItem = useCallback((vendorId: string, listingId: string) => {
    setState((s) => {
      const c = s.carts[vendorId];
      if (!c) return s;
      const items = c.items.filter((x) => x.listingId !== listingId);
      const carts = { ...s.carts };
      if (items.length) carts[vendorId] = { ...c, items };
      else delete carts[vendorId];
      return { carts };
    });
  }, []);

  const clearStore = useCallback((vendorId: string) => {
    setState((s) => {
      if (!s.carts[vendorId]) return s;
      const carts = { ...s.carts };
      delete carts[vendorId];
      return { carts };
    });
  }, []);

  const clear = useCallback(() => setState({ carts: {} }), []);

  const carts = Object.values(state.carts);
  const count = carts.reduce((n, c) => n + c.items.reduce((m, x) => m + x.qty, 0), 0);
  const subtotal = carts.reduce((n, c) => n + c.items.reduce((m, x) => m + x.price * x.qty, 0), 0);

  return (
    <CartContext.Provider value={{
      carts, count, subtotal, isOpen,
      open: () => setIsOpen(true), close: () => setIsOpen(false),
      addItem, startNewCart, setQty, removeItem, clearStore, clear,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
