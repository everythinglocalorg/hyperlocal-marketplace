// Minimal, safe Markdown → HTML for blog posts.
// HTML is escaped FIRST, then a constrained set of Markdown constructs is turned
// into tags, so author-written content can't inject markup. Links are only
// produced from [text](url) with http(s)/mailto URLs. External links open in a
// new tab but are NOT nofollow — so business backlinks pass link equity (SEO).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || u.startsWith("/")) return u;
  return null;
}

// Inline: links, bold, italic, code. Input is already HTML-escaped.
function renderInline(text: string): string {
  // images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const safe = safeUrl(url);
    if (!safe) return alt;
    return `<img src="${safe}" alt="${alt}" class="rounded-xl my-4 w-full" loading="lazy" />`;
  });
  // links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    const external = /^https?:\/\//i.test(safe);
    const attrs = external ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${safe}"${attrs} class="text-green-700 underline hover:text-green-800">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-100 rounded px-1.5 py-0.5 text-sm">$1</code>');
  return text;
}

export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md.replace(/\r\n/g, "\n")).split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p class="mb-5 leading-relaxed text-gray-700">${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") { flushParagraph(); closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushParagraph(); closeList();
      const level = h[1].length;
      const sizes = ["text-3xl", "text-2xl", "text-xl", "text-lg"];
      out.push(`<h${level} class="font-black text-gray-900 mt-8 mb-3 ${sizes[level - 1]}">${renderInline(h[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph(); closeList();
      out.push(`<blockquote class="border-l-4 border-green-500 pl-4 italic text-gray-600 my-5">${renderInline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph(); closeList();
      out.push('<hr class="my-8 border-gray-100" />');
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushParagraph();
      const want = ul ? "ul" : "ol";
      if (listType !== want) { closeList(); listType = want; out.push(`<${want} class="mb-5 ml-5 space-y-1.5 ${want === "ul" ? "list-disc" : "list-decimal"} text-gray-700">`); }
      out.push(`<li class="leading-relaxed">${renderInline((ul ? ul[1] : ol![1]))}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return out.join("\n");
}
