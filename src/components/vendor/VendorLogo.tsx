// Shared vendor logo/avatar. Renders the logo on a white background with
// object-contain (so transparent PNGs never show a colored background and
// non-square logos are never cropped). Falls back to the first letter of the
// business name on a green tile. Used everywhere a vendor logo appears so the
// treatment stays consistent across desktop and mobile.

interface VendorLogoProps {
  src: string | null | undefined;
  name: string;
  /** Tailwind sizing/positioning classes for the container, e.g. "w-12 h-12". */
  className?: string;
  /** Corner rounding class. Defaults to rounded-xl. */
  rounded?: string;
  /** Text size class for the fallback letter. Defaults to text-sm. */
  fallbackTextClass?: string;
}

export default function VendorLogo({
  src,
  name,
  className = "",
  rounded = "rounded-xl",
  fallbackTextClass = "text-sm",
}: VendorLogoProps) {
  return (
    <div
      className={`${rounded} overflow-hidden flex items-center justify-center shrink-0 ${
        src ? "bg-white border border-gray-100" : "bg-green-100"
      } ${className}`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-contain" />
      ) : (
        <span className={`font-bold text-green-700 ${fallbackTextClass}`}>
          {name?.[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </div>
  );
}
