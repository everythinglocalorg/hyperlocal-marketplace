// The six standardized listing CTAs, shared by the vendor listing form and the
// public listing card so labels and behavior never drift.
//
// `action` is what the public listing card does when clicked:
//   book    → booking modal (Rent Now is the rental variant of the same modal)
//   message → lead-gen / estimate inquiry form
//   call    → tel: link to the vendor's phone
//   menu    → vendor's saved menu PDF (vendors.menu_pdf_url) in a new tab
//   buy     → purchase modal
export const LISTING_CTAS = {
  book: { label: "Book Now", action: "book" },
  estimate: { label: "Free Estimate", action: "message" },
  call: { label: "Call Now", action: "call" },
  menu: { label: "See Menu", action: "menu" },
  buy: { label: "Buy Now", action: "buy" },
  rent: { label: "Rent Now", action: "book" },
} as const;

export type ListingCtaType = keyof typeof LISTING_CTAS;
export type ListingCtaAction = (typeof LISTING_CTAS)[ListingCtaType]["action"];

export const LISTING_CTA_OPTIONS = (Object.keys(LISTING_CTAS) as ListingCtaType[]).map(
  (value) => ({ value, label: LISTING_CTAS[value].label })
);

export function isListingCtaType(value: unknown): value is ListingCtaType {
  return typeof value === "string" && value in LISTING_CTAS;
}

// Sensible starting CTA when a vendor picks a listing type in the form.
export function defaultCtaForListingType(type: string): ListingCtaType {
  switch (type) {
    case "rental": return "rent";
    case "housing_rent": return "rent";
    case "housing_sale": return "estimate";
    case "restaurant": return "menu";
    case "service": return "estimate";
    case "event": return "book";
    default: return "buy"; // product, thrift
  }
}
