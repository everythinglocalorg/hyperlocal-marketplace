"use client";

import { useState, useEffect } from "react";

// Cycles through `phrases`, typing each one out, holding, deleting, then moving
// to the next — forever. Used for the homepage hero so one fixed line
// ("Discover the best ___ in {City}.") rotates the middle word.
export default function TypedRotator({ phrases, className, holdMs = 1600, typeMs = 55, deleteMs = 28 }: {
  phrases: string[];
  className?: string;
  holdMs?: number;
  typeMs?: number;
  deleteMs?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = phrases[idx % phrases.length] ?? "";

    if (!deleting && shown === full) {
      const t = setTimeout(() => setDeleting(true), holdMs);
      return () => clearTimeout(t);
    }
    if (deleting && shown === "") {
      setDeleting(false);
      setIdx((i) => (i + 1) % phrases.length);
      return;
    }
    const t = setTimeout(() => {
      setShown((s) => (deleting ? full.slice(0, s.length - 1) : full.slice(0, s.length + 1)));
    }, deleting ? deleteMs : typeMs);
    return () => clearTimeout(t);
  }, [shown, deleting, idx, phrases, holdMs, typeMs, deleteMs]);

  return (
    <span className={className}>
      {shown}
      <span className="inline-block w-[0.06em] -mb-[0.05em] animate-pulse" aria-hidden="true">|</span>
    </span>
  );
}
