import React from "react";

// Lightweight markdown for storefront page blocks. Supports, inline:
//   **bold**  *italic*  [text](https://url)
// and, per line:
//   "# heading"   → larger bold line
//   "- item"      → bullet list
// Everything else is a paragraph. Safe by construction — only anchors are
// emitted (with rel="noopener"), never raw HTML.

const INLINE = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;

function parseInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <a key={`${keyBase}-a${i}`} href={m[3]} target="_blank" rel="noopener noreferrer"
          className="underline decoration-2 underline-offset-2 hover:opacity-80" style={{ color: "inherit" }}>{m[2]}</a>
      );
    } else if (m[4]) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[5]}</strong>);
    } else if (m[6]) {
      nodes.push(<em key={`${keyBase}-i${i}`}>{m[7]}</em>);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderRichText(text: string | null | undefined): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    out.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 mb-2 last:mb-0">
        {items.map((b, i) => <li key={i}>{parseInline(b, `li-${key}-${i}`)}</li>)}
      </ul>
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); return; }
    flushBullets(String(idx));
    if (line === "") return;
    if (line.startsWith("# ")) {
      out.push(<p key={`h-${idx}`} className="font-bold text-lg mb-2 last:mb-0">{parseInline(line.slice(2), `h-${idx}`)}</p>);
      return;
    }
    out.push(<p key={`p-${idx}`} className="mb-2 last:mb-0">{parseInline(line, `p-${idx}`)}</p>);
  });
  flushBullets("end");
  return out;
}
