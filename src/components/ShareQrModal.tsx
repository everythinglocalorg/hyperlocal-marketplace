"use client";

import { useEffect, useRef, useState } from "react";
import QrCode from "@/components/QrCode";

// The user's QR "wallet" — swipe between their referral link, their public
// profile, and (if they run a business) their storefront. Built on CSS
// scroll-snap so the swipe is native on touch, with dots + arrows for desktop.

export type ShareSlide = {
  key: string;
  label: string;      // dot / header label
  title: string;
  blurb: string;
  link: string;
  downloadName?: string;
};

export default function ShareQrModal({
  slides,
  onClose,
}: {
  slides: ShareSlide[];
  onClose: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // Track which slide is centred as they swipe.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(Math.max(0, Math.min(slides.length - 1, i)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length]);

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  const current = slides[index];

  function copy() {
    navigator.clipboard?.writeText(current.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: current.title, url: current.link });
        return;
      } catch { /* cancelled — fall back to copy */ }
    }
    copy();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle (mobile sheet) */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 sm:pt-4">
          <h2 className="font-bold text-gray-900">Share</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        {slides.length > 1 && (
          <div className="flex gap-1 px-5 pt-3">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-colors ${
                  i === index ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Swipeable track */}
        <div
          ref={trackRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {slides.map((s) => (
            <div key={s.key} className="min-w-full snap-center px-5 py-4">
              <div className="flex flex-col items-center text-center">
                <p className="text-base font-bold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 mb-3 max-w-[15rem]">{s.blurb}</p>
                <div className="border border-gray-100 rounded-2xl p-3 shadow-sm">
                  <QrCode value={s.link} size={190} alt={s.title} downloadName={s.downloadName} />
                </div>
                <p className="text-[11px] text-gray-400 mt-2.5 break-all max-w-[16rem]">{s.link}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-1">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                aria-label={`Go to ${s.label}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-green-600" : "w-1.5 bg-gray-200"}`}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 px-5 pb-5 pt-3">
          <button
            onClick={copy}
            className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy link"}
          </button>
          <button
            onClick={share}
            className="flex-1 bg-green-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
