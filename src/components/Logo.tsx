// Brand logo: a green location pin with a house hidden inside (the marker holds
// a home) + the stacked EVERYTHING / LOCAL wordmark. Reusable everywhere.

export default function Logo({
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

// The pin mark on its own (tight spaces / favicons / avatars). A house sits
// inside the marker — "local is where you belong."
export function LogoMark({ className = "h-10 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z"
        fill="#16a34a"
      />
      {/* house inside the pin */}
      <path d="M20 10.5 30 19h-3v9.5H13V19h-3z" fill="#ffffff" />
      <rect x="18" y="23" width="4" height="5.5" fill="#16a34a" />
    </svg>
  );
}
