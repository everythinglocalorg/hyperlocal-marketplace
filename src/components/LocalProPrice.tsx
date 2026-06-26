import { LOCAL_PRO_ORIGINAL_PRICE, LOCAL_PRO_PRICE } from "@/lib/pricing";

type LocalProPriceProps = {
  size?: "sm" | "md" | "lg" | "xl";
  inverted?: boolean;
  suffix?: string | false;
  className?: string;
};

const sizeStyles = {
  sm: {
    wrapper: "gap-1.5",
    original: "text-sm",
    price: "text-base font-bold",
    suffix: "text-xs font-normal",
  },
  md: {
    wrapper: "gap-2",
    original: "text-base",
    price: "text-xl font-bold",
    suffix: "text-sm font-normal",
  },
  lg: {
    wrapper: "gap-2",
    original: "text-lg",
    price: "text-4xl font-bold",
    suffix: "text-lg font-normal",
  },
  xl: {
    wrapper: "gap-2",
    original: "text-xl",
    price: "text-5xl font-bold",
    suffix: "text-base font-normal mb-2",
  },
} as const;

export default function LocalProPrice({
  size = "md",
  inverted = false,
  suffix = "/mo",
  className = "",
}: LocalProPriceProps) {
  const s = sizeStyles[size];
  const originalColor = inverted ? "text-green-200/80" : "text-gray-400";
  const priceColor = inverted ? "text-white" : "text-gray-900";
  const suffixColor = inverted ? "text-green-200" : "text-gray-400";

  return (
    <span className={`inline-flex items-baseline flex-wrap ${s.wrapper} ${className}`}>
      <span className={`line-through ${originalColor} ${s.original}`}>
        ${LOCAL_PRO_ORIGINAL_PRICE}
      </span>
      <span className={`${priceColor} ${s.price}`}>
        ${LOCAL_PRO_PRICE}
        {suffix !== false && (
          <span className={`${suffixColor} ${s.suffix}`}>{suffix}</span>
        )}
      </span>
    </span>
  );
}

type LocalProPriceInlineProps = {
  inverted?: boolean;
  className?: string;
};

export function LocalProPriceInline({ inverted = false, className = "" }: LocalProPriceInlineProps) {
  const originalColor = inverted ? "text-green-200/70" : "text-gray-400";
  const priceColor = inverted ? "text-white font-semibold" : "font-semibold text-gray-900";

  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={`line-through ${originalColor}`}>${LOCAL_PRO_ORIGINAL_PRICE}</span>
      <span className={priceColor}>${LOCAL_PRO_PRICE}/month</span>
    </span>
  );
}
