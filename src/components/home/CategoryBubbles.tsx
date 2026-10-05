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

// Home category bubbles — one list on mobile + desktop. Signed-in users can
// press-and-hold a category to pin it to the FRONT (order saved per-device on
// every change). A hold is used instead of free drag because a horizontal drag
// on a scrolling row is read as scrolling on touch; a hold never fights scroll,
// a swipe still scrolls, and a tap still filters. "All" stays pinned first.
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

  // ── Press-and-hold to pin to front ───────────────────────────────────────
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [justPinned, setJustPinned] = useState<string | null>(null);

  function clearTimer() { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }

  function promote(label: string) {
    setOrder((prev) => {
      const next = [label, ...prev.filter((l) => l !== label)];
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    suppressClick.current = true; // the hold shouldn't also trigger a filter
    setJustPinned(label);
    setTimeout(() => setJustPinned((p) => (p === label ? null : p)), 650);
  }

  function onDown(e: React.PointerEvent, label: string) {
    if (!canReorder) return;
    startXY.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => promote(label), 450);
  }
  function onMove(e: React.PointerEvent) {
    const s = startXY.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) clearTimer(); // moved → it's a scroll/tap
  }
  function onEnd() { clearTimer(); startXY.current = null; }

  function renderBubble(item: BubbleItem, holdable: boolean) {
    const isActive = item.nav ? false : item.label === activeLabel;
    const Icon = item.Icon;
    const isPinning = justPinned === item.label;
    return (
      <button
        key={item.label}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (item.nav) onNav(item.nav); else onPick(item.filter ?? null);
        }}
        {...(holdable ? {
          onPointerDown: (e: React.PointerEvent) => onDown(e, item.label),
          onPointerMove: onMove,
          onPointerUp: onEnd,
          onPointerLeave: onEnd,
          onPointerCancel: onEnd,
        } : {})}
        className={`shrink-0 w-[60px] flex flex-col items-center gap-1.5 transition-transform ${isPinning ? "scale-110" : ""}`}
      >
        <span className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isActive ? "bg-green-600 border border-green-600 text-white" : "bg-green-50 border border-green-100 text-green-700 hover:border-green-300"}`}>
          <Icon className="w-6 h-6" strokeWidth={1.8} />
        </span>
        <span className={`text-[10px] leading-tight text-center ${isActive ? "text-green-700 font-semibold" : "text-gray-600"}`}>{item.label}</span>
      </button>
    );
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex gap-3.5 overflow-x-auto scrollbar-hide px-3 pt-3 pb-2 md:flex-wrap md:justify-center md:gap-x-4 md:gap-y-3 md:overflow-visible md:max-w-5xl md:mx-auto">
        {allItem && renderBubble(allItem, false)}
        {order.map((l) => { const it = byLabel.get(l); return it ? renderBubble(it, canReorder) : null; })}
      </div>
      {canReorder && (
        <p className="text-[10px] text-gray-400 text-center pb-2">Tip: press &amp; hold a category to pin it to the front</p>
      )}
    </div>
  );
}
