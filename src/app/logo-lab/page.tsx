import type { Metadata } from "next";
import { Archivo_Black, Oswald, Anton, Barlow_Semi_Condensed, Sora } from "next/font/google";

// Throwaway preview: concept A (green pin + black wordmark) in several sleek
// typefaces, stacked and single-line, to pick the final one. Not indexed.
export const metadata: Metadata = { title: "Logo lab", robots: { index: false, follow: false } };

const archivo = Archivo_Black({ subsets: ["latin"], weight: "400" });
const oswald = Oswald({ subsets: ["latin"], weight: "700" });
const anton = Anton({ subsets: ["latin"], weight: "400" });
const barlow = Barlow_Semi_Condensed({ subsets: ["latin"], weight: "700" });
const sora = Sora({ subsets: ["latin"], weight: "800" });

const FONTS = [
  { name: "Archivo Black", cls: archivo.className, note: "Clean, modern, versatile" },
  { name: "Oswald", cls: oswald.className, note: "Tall + condensed — most North-Face" },
  { name: "Anton", cls: anton.className, note: "Ultra-heavy display" },
  { name: "Barlow Semi Condensed", cls: barlow.className, note: "Sporty, friendly condensed" },
  { name: "Sora", cls: sora.className, note: "Geometric, techy" },
];

function Pin({ h }: { h: number }) {
  return (
    <svg viewBox="0 0 40 52" height={h} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z" fill="#00a63e" />
      <path d="M20 10.6 28 18.4H25.4V27H14.6V18.4H12z" fill="#fff" />
      <rect x="18" y="22" width="4" height="5" fill="#00a63e" />
    </svg>
  );
}

export default function LogoLab() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Logo lab — concept A, font options</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 28 }}>
        Green pin + black wordmark. Each row: <strong>stacked</strong> (brand mark) and <strong>single line</strong> (header). Tell me a font name + which layout for the header.
      </p>

      {FONTS.map((f) => (
        <div key={f.name} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</span>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>· {f.note}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
            {/* Stacked */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Pin h={54} />
              <div className={f.cls} style={{ display: "flex", flexDirection: "column", lineHeight: 0.88, textTransform: "uppercase", letterSpacing: "-0.01em", fontSize: 30 }}>
                <span>Everything</span>
                <span>Local</span>
              </div>
            </div>

            {/* Single line */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Pin h={38} />
              <span className={f.cls} style={{ textTransform: "uppercase", fontSize: 24, letterSpacing: "-0.01em" }}>Everything&nbsp;Local</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
