// Brand logo: a green county/highway-style sign — white border, a location pin
// with a house hidden inside, and EVERYTHING LOCAL on one line. `textLength`
// locks the wordmark width so it always fits the sign regardless of the
// visitor's installed fonts. Use `LogoMark` (bare pin) for tiny spots/favicons.

export default function Logo({
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
      className={`${h} w-auto ${className}`}
      role="img"
      aria-label="Everything Local"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="552" height="122" rx="18" fill="#0c7a3c" />
      <rect x="15" y="15" width="530" height="100" rx="11" fill="none" stroke="#ffffff" strokeWidth="3.5" />
      <g transform="translate(34,33) scale(1.5)">
        <path
          d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z"
          fill="#ffffff"
        />
        <path d="M20 10.5 30 19h-3v9.5H13V19h-3z" fill="#0c7a3c" />
        <rect x="18" y="23" width="4" height="5.5" fill="#ffffff" />
      </g>
      <text
        x="108"
        y="82"
        fontSize="46"
        fontWeight="800"
        fill="#ffffff"
        fontFamily="'Arial Narrow', Arial, system-ui, sans-serif"
        letterSpacing="0.5"
        textLength="424"
        lengthAdjust="spacingAndGlyphs"
      >
        EVERYTHING LOCAL
      </text>
    </svg>
  );
}

// The bare pin mark (tight spaces / favicons / avatars). A house sits inside
// the marker — "local is where you belong."
export function LogoMark({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z"
        fill="#16a34a"
      />
      <path d="M20 10.5 30 19h-3v9.5H13V19h-3z" fill="#ffffff" />
      <rect x="18" y="23" width="4" height="5.5" fill="#16a34a" />
    </svg>
  );
}
