"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

// A single-vendor shopping cart, persisted to localStorage. You can only hold
// items from ONE store at a time — each vendor's payments run through their own
// Stripe account, so a cart can't span stores. Adding from a different store
// surfaces a "conflict" the UI resolves by starting a fresh cart.

export type CartItem = { listingId: string; title: string; price: number; image: string | null; qty: number; porchPickup?: boolean; localDrop?: boolean; pickupInfo?: string | null; dropInfo?: string | null };
export type CartVendor = { id: string; name: string; slug: string; pickupInfo?: string | null; dropInfo?: string | null };
type CartState = { vendor: CartVendor | null; items: CartItem[] };

type CartContextValue = {
  vendor: CartVendor | null;
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (vendor: CartVendor, item: Omit<CartItem, "qty">, qty?: number) => "added" | "conflict";
  startNewCart: (vendor: CartVendor, item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (listingId: string, qty: number) => void;
  removeItem: (listingId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const LS_KEY = "el_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>({ vendor: null, items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setState(JSON.parse(raw)); } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ } }
  }, [state, hydrated]);

  const addItem = useCallback((vendor: CartVendor, item: Omit<CartItem, "qty">, qty = 1): "added" | "conflict" => {
    let result: "added" | "conflict" = "added";
    setState((s) => {
      if (s.vendor && s.vendor.id !== vendor.id && s.items.length > 0) { result = "conflict"; return s; }
      const items = [...s.items];
      const idx = items.findIndex((x) => x.listingId === item.listingId);
      if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + qty };
      else items.push({ ...item, qty });
      return { vendor, items };
    });
    return result;
  }, []);

  const startNewCart = useCallback((vendor: CartVendor, item: Omit<CartItem, "qty">, qty = 1) => {
    setState({ vendor, items: [{ ...item, qty }] });
  }, []);

  const setQty = useCallback((listingId: string, qty: number) => {
    setState((s) => ({ ...s, items: s.items.map((x) => x.listingId === listingId ? { ...x, qty: Math.max(1, qty) } : x) }));
  }, []);

  const removeItem = useCallback((listingId: string) => {
    setState((s) => {
      const items = s.items.filter((x) => x.listingId !== listingId);
      return { vendor: items.length ? s.vendor : null, items };
    });
  }, []);

  const clear = useCallback(() => setState({ vendor: null, items: [] }), []);

  const count = state.items.reduce((n, x) => n + x.qty, 0);
  const subtotal = state.items.reduce((n, x) => n + x.price * x.qty, 0);

  return (
    <CartContext.Provider value={{
      vendor: state.vendor, items: state.items, count, subtotal, isOpen,
      open: () => setIsOpen(true), close: () => setIsOpen(false),
      addItem, startNewCart, setQty, removeItem, clear,
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
