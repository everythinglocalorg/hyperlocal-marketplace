"use client";

import { useEffect, useState, useCallback } from "react";

// A lightweight guided tour: dims the screen, spotlights one target element at a
// time (found by CSS selector), and shows a titled callout with Next/Back/Skip.
// Targets are marked with data-tour="..." on the real elements. If a target
// isn't on the page, that step shows as a centered card instead of breaking.

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  padding?: number;
};

const CARD_W = 288; // w-72
const EST_CARD_H = 200;

export default function ProductTour({
  steps,
  onDone,
  storageKey = "el_tour_done",
}: {
  steps: TourStep[];
  onDone?: () => void;
  storageKey?: string;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [active, setActive] = useState(true);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setRect(el.getBoundingClientRect());
  }, [step]);

  useEffect(() => {
    measure();
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const t = setTimeout(measure, 380); // re-measure after smooth scroll settles
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      clearTimeout(t);
    };
  }, [measure]);

  const finish = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(storageKey, "1"); } catch { /* noop */ }
    onDone?.();
  }, [onDone, storageKey]);

  if (!active || !step) return null;

  const pad = step.padding ?? 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 }
    : null;

  // Place the callout below the target, or above it when the target sits low.
  let cardTop: number;
  let cardLeft: number;
  if (hole) {
    const below = hole.top + hole.h + 14;
    const placeAbove = below + EST_CARD_H > vh;
    cardTop = placeAbove ? Math.max(12, hole.top - 14 - EST_CARD_H) : below;
    cardLeft = Math.min(Math.max(12, hole.left + hole.w / 2 - CARD_W / 2), vw - CARD_W - 12);
  } else {
    cardTop = vh / 2 - EST_CARD_H / 2;
    cardLeft = vw / 2 - CARD_W / 2;
  }

  const isLast = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      {hole ? (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            top: hole.top, left: hole.left, width: hole.w, height: hole.h,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
            outline: "3px solid #16a34a", outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/62" />
      )}

      <div
        className="fixed w-72 max-w-[92vw] bg-white rounded-2xl shadow-2xl p-4 transition-all duration-300"
        style={{ top: cardTop, left: cardLeft }}
      >
        <p className="text-[11px] font-semibold text-gray-400">Step {i + 1} of {steps.length}</p>
        <h3 className="text-base font-bold text-gray-900 mt-0.5">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mt-1">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={finish} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Skip tour
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setI(i + 1))}
              className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
            >
              {isLast ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
