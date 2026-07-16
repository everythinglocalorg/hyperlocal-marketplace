// Curated storefront fonts. Shared by the vendor Store Settings typography
// picker and the public storefront so labels, stacks, and Google Font loading
// never drift. Stored per-vendor in vendors.theme (jsonb).

export type StoreTheme = {
  heading_font?: string | null;
  body_font?: string | null;
  text_scale?: "sm" | "base" | "lg" | null;
};

type FontDef = { label: string; stack: string; google?: string };

// `google` is the css2 `family=` param (omit for system fonts that need no load).
export const STORE_FONTS: Record<string, FontDef> = {
  inter:      { label: "Inter",            stack: "'Inter', system-ui, sans-serif",       google: "Inter:wght@400;500;600;700" },
  playfair:   { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif",   google: "Playfair+Display:ital,wght@0,500;0,600;0,700;1,500" },
  poppins:    { label: "Poppins",          stack: "'Poppins', system-ui, sans-serif",     google: "Poppins:wght@400;500;600;700" },
  montserrat: { label: "Montserrat",       stack: "'Montserrat', system-ui, sans-serif",  google: "Montserrat:wght@400;500;600;700" },
  oswald:     { label: "Oswald",           stack: "'Oswald', system-ui, sans-serif",      google: "Oswald:wght@400;500;600;700" },
  lora:       { label: "Lora",             stack: "'Lora', Georgia, serif",               google: "Lora:ital,wght@0,400;0,500;0,600;1,400" },
  nunito:     { label: "Nunito",           stack: "'Nunito', system-ui, sans-serif",      google: "Nunito:wght@400;500;600;700" },
  source:     { label: "Source Sans",      stack: "'Source Sans 3', system-ui, sans-serif", google: "Source+Sans+3:wght@400;500;600;700" },
  system:     { label: "System default",   stack: "system-ui, -apple-system, sans-serif" },
};

// Which fonts appear in each picker.
export const HEADING_FONT_KEYS = ["inter", "playfair", "poppins", "montserrat", "oswald", "lora"] as const;
export const BODY_FONT_KEYS = ["inter", "nunito", "source", "lora", "system"] as const;

export const DEFAULT_HEADING_FONT = "inter";
export const DEFAULT_BODY_FONT = "inter";

// Base body font-size in px for each text-size choice.
export const TEXT_SCALE_PX: Record<string, number> = { sm: 15, base: 16, lg: 18 };
export const TEXT_SCALE_LABEL: Record<string, string> = { sm: "Small", base: "Normal", lg: "Large" };

export function fontStack(key?: string | null): string {
  return STORE_FONTS[key ?? ""]?.stack ?? STORE_FONTS[DEFAULT_BODY_FONT].stack;
}

export function textScalePx(scale?: string | null): number {
  return TEXT_SCALE_PX[scale ?? ""] ?? TEXT_SCALE_PX.base;
}

// Build the Google Fonts <link> href for the given font keys (deduped, system skipped).
export function buildGoogleFontsHref(keys: Array<string | null | undefined>): string | null {
  const params = Array.from(
    new Set(keys.map((k) => STORE_FONTS[k ?? ""]?.google).filter(Boolean) as string[])
  );
  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.map((p) => `family=${p}`).join("&")}&display=swap`;
}

// Normalize a raw vendors.theme value into a safe StoreTheme.
export function normalizeTheme(raw: unknown): Required<StoreTheme> {
  const t = (raw ?? {}) as StoreTheme;
  const heading = t.heading_font && STORE_FONTS[t.heading_font] ? t.heading_font : DEFAULT_HEADING_FONT;
  const body = t.body_font && STORE_FONTS[t.body_font] ? t.body_font : DEFAULT_BODY_FONT;
  const scale = t.text_scale && TEXT_SCALE_PX[t.text_scale] ? t.text_scale : "base";
  return { heading_font: heading, body_font: body, text_scale: scale };
}
