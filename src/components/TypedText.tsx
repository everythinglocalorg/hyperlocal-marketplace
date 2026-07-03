"use client";

import { useState, useEffect } from "react";

// Types `text` out character-by-character with a blinking caret.
// Re-runs whenever the text changes (e.g. when the active city switches).
export default function TypedText({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 85);
    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className}>
      {shown}
      <span className="inline-block w-[0.06em] -mb-[0.05em] animate-pulse" aria-hidden="true">|</span>
    </span>
  );
}
