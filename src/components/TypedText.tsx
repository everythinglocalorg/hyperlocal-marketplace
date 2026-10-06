"use client";

import { useEffect, useRef, useState } from "react";

// Self-contained typewriter: types each phrase out, holds, deletes, moves on.
// Owns its own state so it re-renders only itself (not a heavy parent). Shows a
// blinking cursor. Respects prefers-reduced-motion by just showing the first phrase.
export default function TypedText({
  phrases,
  text: fixedText,
  className = "",
  typeMs = 75,
  deleteMs = 35,
  holdMs = 1500,
  startMs = 500,
}: {
  phrases?: string[];
  // Back-compat: pass `text` to just render a string (no animation).
  text?: string;
  className?: string;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  startMs?: number;
}) {
  const [text, setText] = useState("");
  const idx = useRef(0);
  const pos = useRef(0);
  const deleting = useRef(false);

  useEffect(() => {
    if (fixedText != null || !phrases?.length) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setText(phrases[0]); return; }
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = phrases[idx.current % phrases.length];
      if (!deleting.current) {
        pos.current++;
        setText(full.slice(0, pos.current));
        if (pos.current >= full.length) { deleting.current = true; timer = setTimeout(tick, holdMs); return; }
        timer = setTimeout(tick, typeMs);
      } else {
        pos.current--;
        setText(full.slice(0, Math.max(0, pos.current)));
        if (pos.current <= 0) { deleting.current = false; idx.current++; timer = setTimeout(tick, 300); return; }
        timer = setTimeout(tick, deleteMs);
      }
    };
    timer = setTimeout(tick, startMs);
    return () => clearTimeout(timer);
  }, [fixedText, phrases?.join("|"), typeMs, deleteMs, holdMs, startMs]);

  if (fixedText != null) return <span className={className}>{fixedText}</span>;

  return (
    <span className={className}>
      {text}
      <span className="inline-block w-px -mb-0.5 ml-0.5 animate-pulse border-r border-current" aria-hidden>&nbsp;</span>
    </span>
  );
}

// Animate an <input>'s placeholder as if example searches are being typed.
// Uses the DOM directly (no React re-renders), and pauses while the user types.
export function useTypedPlaceholder(
  ref: React.RefObject<HTMLInputElement | null>,
  phrases: string[],
  { typeMs = 75, deleteMs = 35, holdMs = 1500, startMs = 500 } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !phrases.length) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.placeholder = phrases[0]; return; }
    let i = 0, p = 0, del = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (el.value) { timer = setTimeout(tick, 600); return; } // user is typing — leave it alone
      const full = phrases[i % phrases.length];
      if (!del) {
        p++; el.placeholder = full.slice(0, p);
        if (p >= full.length) { del = true; timer = setTimeout(tick, holdMs); return; }
        timer = setTimeout(tick, typeMs);
      } else {
        p--; el.placeholder = full.slice(0, Math.max(0, p));
        if (p <= 0) { del = false; i++; timer = setTimeout(tick, 300); return; }
        timer = setTimeout(tick, deleteMs);
      }
    };
    timer = setTimeout(tick, startMs);
    return () => clearTimeout(timer);
  }, [ref, phrases.join("|"), typeMs, deleteMs, holdMs, startMs]);
}

// Shared example searches for the home search bar.
export const SEARCH_EXAMPLES = [
  "plumber near me",
  "fresh eggs",
  "haircut",
  "food trucks",
  "thrift deals",
  "lawn care",
  "coffee shops",
  "handyman",
  "live music tonight",
  "dog groomer",
];
