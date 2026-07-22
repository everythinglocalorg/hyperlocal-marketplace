// Brand logo system.
//
// - `Logo`      → current look: green pin + a sleek single-line ARCHIVO BLACK
//                 "EVERYTHING LOCAL" wordmark.
// - `LogoSign`  → the old county/highway sign look, kept in case we flip back.
// - `LogoV2`    → pin + stacked wordmark + tagline (earlier look).
// - `LogoMark`  → the bare pin only (favicons / avatars / tiny spots).

import { Archivo_Black } from "next/font/google";

const archivo = Archivo_Black({ subsets: ["latin"], weight: "400" });

// Shared pin geometry (the house is a cut-out; `houseFill` = the color showing
// through it, `doorFill` = the little doorway).
function Pin({ pinFill, houseFill, doorFill }: { pinFill: string; houseFill: string; doorFill: string }) {
  return (
    <>
      <path
        d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z"
        fill={pinFill}
      />
      <path d="M20 10.6 28 18.4H25.4V27H14.6V18.4H12z" fill={houseFill} />
      <rect x="18" y="22" width="4" height="5" fill={doorFill} />
    </>
  );
}

// THE standard logo — green pin + stacked Archivo Black wordmark. Use this
// everywhere a brand mark is needed (header, footer, storefront, auth,
// onboarding, dashboards). Sizes: sm (nav bars), md (default), lg (heroes).
export default function Logo({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pin = size === "lg" ? "h-14" : size === "sm" ? "h-8" : "h-11";
  const word = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Everything Local">
      <LogoMark className={`${pin} w-auto shrink-0`} />
      <span className={`${archivo.className} flex flex-col leading-[0.85] uppercase tracking-tight text-gray-900`}>
        <span className={word}>Everything</span>
        <span className={word}>Local</span>
      </span>
    </span>
  );
}

// Old county/highway-sign look — kept in case we want to flip back.
export function LogoSign({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const h = size === "lg" ? "h-16" : size === "sm" ? "h-10" : "h-12";
  return (
    <svg
      viewBox="0 0 560 130"
      className={`${h} w-auto text-green-600 ${className}`}
      role="img"
      aria-label="Everything Local"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="552" height="122" rx="18" fill="currentColor" />
      <rect x="15" y="15" width="530" height="100" rx="11" fill="none" stroke="#ffffff" strokeWidth="3.5" />
      <g transform="translate(43,31) scale(1.3)">
        <Pin pinFill="#ffffff" houseFill="currentColor" doorFill="#ffffff" />
      </g>
      <text
        x="108"
        y="80"
        fontSize="44"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="'Arial Narrow', Arial, system-ui, sans-serif"
        letterSpacing="0.5"
        textLength="428"
        lengthAdjust="spacingAndGlyphs"
      >
        EVERYTHING LOCAL
      </text>
    </svg>
  );
}

// Previous look, preserved as v2 — pin + stacked wordmark + tagline.
export function LogoV2({
  className = "",
  showTagline = true,
  size = "md",
}: {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const pin = size === "lg" ? "h-12" : size === "sm" ? "h-8" : "h-10";
  const word = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base sm:text-lg";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={`${pin} w-auto shrink-0`} />
      <span className="flex flex-col leading-[0.92]">
        <span className={`${word} font-extrabold tracking-tight text-gray-900 uppercase`}>Everything</span>
        <span className={`${word} font-extrabold tracking-tight text-green-600 uppercase`}>Local</span>
        {showTagline && (
          <span className="text-[8px] sm:text-[9px] font-bold tracking-[0.14em] text-gray-400 uppercase mt-0.5">
            Rent · Ask · Buy · Sell +
          </span>
        )}
      </span>
    </span>
  );
}

// Bare pin — green marker, white house, green door.
export function LogoMark({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={`${className} text-green-600`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <Pin pinFill="currentColor" houseFill="#ffffff" doorFill="currentColor" />
    </svg>
  );
}
