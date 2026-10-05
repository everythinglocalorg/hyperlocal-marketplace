"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

export type BubbleItem = {
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  filter?: unknown;
  nav?: string;
};

const LS_KEY = "el_cat_order";

// Home category bubbles — one list on mobile + desktop. Signed-in users can drag
// to pull their favorites to the front; the order is saved per-device
// (localStorage) on every change. "All" stays pinned first and isn't draggable.
export default function CategoryBubbles({
  items,
  activeLabel,
  canReorder,
  onPick,
  onNav,
}: {
  items: BubbleItem[];
  activeLabel: string | null;
  canReorder: boolean;
  onPick: (filter: unknown) => void;
  onNav: (href: string) => void;
}) {
  const allItem = items.find((i) => i.label === "All");
  const rest = items.filter((i) => i.label !== "All");
  const byLabel = new Map(items.map((i) => [i.label, i]));

  // Reorderable labels. Hydrate from localStorage (when allowed), merging with
  // the live set: drop stale labels, append any new categories at the end.
  const [order, setOrder] = useState<string[]>(() => rest.map((i) => i.label));
  useEffect(() => {
    if (!canReorder) { setOrder(rest.map((i) => i.label)); return; }
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { /* noop */ }
    const existing = new Set(rest.map((i) => i.label));
    const merged = saved.filter((l) => existing.has(l));
    for (const i of rest) if (!merged.includes(i.label)) merged.push(i.label);
    setOrder(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReorder, items.map((i) => i.label).join("|")]);

  function persist(next: string[]) {
    setOrder(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }

  // ── Pointer drag (touch long-press + mouse) ──────────────────────────────
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const ptr = useRef<{ x: number; y: number; label: string; pid: number; type: string; el: HTMLElement } | null>(null);
  const draggingRef = useRef(false);
  const suppressClick = useRef(false);
  const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function clearLP() { if (lp.current) { clearTimeout(lp.current); lp.current = null; } }

  function labelAtX(x: number): string | null {
    for (const l of order) {
      const el = itemRefs.current[l];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right) return l;
    }
    return null;
  }

  function begin(label: string) {
    const p = ptr.current; if (!p) return;
    try { p.el.setPointerCapture(p.pid); } catch { /* ignore */ }
    draggingRef.current = true;
    setDragLabel(label);
    setIsDragging(true);
    if (p.type !== "mouse" && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
  }

  function onDown(e: React.PointerEvent, label: string) {
    if (!canReorder) return;
    ptr.current = { x: e.clientX, y: e.clientY, label, pid: e.pointerId, type: e.pointerType, el: e.currentTarget as HTMLElement };
    clearLP();
    // Touch: hold ~250ms to pick up (a swipe before then stays a scroll).
    lp.current = setTimeout(() => {
      const p = ptr.current;
      if (p && p.label === label && !draggingRef.current) begin(label);
    }, 250);
  }

  function onMove(e: React.PointerEvent, label: string) {
    const p = ptr.current; if (!p || p.label !== label) return;
    if (!draggingRef.current) {
      const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.type === "mouse") { if (d > 6) { clearLP(); begin(label); } }
      else if (d > 10) { clearLP(); } // moved before the hold → let the row scroll
      return;
    }
    const over = labelAtX(e.clientX);
    if (over && over !== label) {
      const next = order.filter((l) => l !== label);
      next.splice(next.indexOf(over), 0, label);
      setOrder(next); // live; persisted on pointer up
    }
  }

  function onUp() {
    clearLP();
    const wasDrag = draggingRef.current;
    draggingRef.current = false;
    ptr.current = null;
    setDragLabel(null);
    setIsDragging(false);
    if (wasDrag) { suppressClick.current = true; persist(order); }
  }

  function renderBubble(item: BubbleItem, draggable: boolean) {
    const isActive = item.nav ? false : item.label === activeLabel;
    const Icon = item.Icon;
    const isDrag = dragLabel === item.label;
    return (
      <button
        key={item.label}
        ref={(el) => { itemRefs.current[item.label] = el; }}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (item.nav) onNav(item.nav); else onPick(item.filter ?? null);
        }}
        {...(draggable ? {
          onPointerDown: (e: React.PointerEvent) => onDown(e, item.label),
          onPointerMove: (e: React.PointerEvent) => onMove(e, item.label),
          onPointerUp: onUp,
          onPointerCancel: onUp,
        } : {})}
        className={`shrink-0 w-[60px] flex flex-col items-center gap-1.5 transition-transform ${isDrag ? "opacity-70 scale-110" : ""}`}
      >
        <span className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isActive ? "bg-green-600 border border-green-600 text-white" : "bg-green-50 border border-green-100 text-green-700 hover:border-green-300"}`}>
          <Icon className="w-6 h-6" strokeWidth={1.8} />
        </span>
        <span className={`text-[10px] leading-tight text-center ${isActive ? "text-green-700 font-semibold" : "text-gray-600"}`}>{item.label}</span>
      </button>
    );
  }

  return (
    <div
      className="flex gap-3.5 overflow-x-auto scrollbar-hide px-3 py-3 border-b border-gray-100 md:flex-wrap md:justify-center md:gap-x-4 md:gap-y-3 md:overflow-visible md:max-w-5xl md:mx-auto"
      style={isDragging ? { touchAction: "none", overscrollBehaviorX: "contain" } : undefined}
    >
      {allItem && renderBubble(allItem, false)}
      {order.map((l) => { const it = byLabel.get(l); return it ? renderBubble(it, canReorder) : null; })}
    </div>
  );
}
