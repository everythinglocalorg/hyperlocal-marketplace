// ─────────────────────────────────────────────────────────────────────────────
// Shared types + pricing math for the DripJobs-style proposal builder.
//
// The price book (estimate_catalog_items) holds a vendor's products. A builder
// line snapshots the catalog values so past estimates never change when the
// vendor later edits their price book. Line total is computed from:
//
//   coverage items (sqft / linear_ft):
//     material = (measurement * coats / spread_rate) * cost_of_goods
//     labor    = measurement * coats * labor_rate
//   count items (each / hour):
//     material = measurement * cost_of_goods
//     labor    = measurement * labor_rate
//   total = (material + labor) * (1 + markup_pct/100)
//
// A manual_total overrides the computed value when the vendor types their own.
// ─────────────────────────────────────────────────────────────────────────────

export type UnitBasis = "sqft" | "linear_ft" | "each" | "hour" | "flat";

export const UNIT_LABEL: Record<UnitBasis, string> = {
  sqft: "sq ft",
  linear_ft: "linear ft",
  each: "each",
  hour: "hour",
  flat: "flat",
};

export type CatalogItem = {
  id: string;
  vendor_id: string;
  substrate: string;
  name: string;
  unit_basis: UnitBasis;
  spread_rate: number | null;
  cost_of_goods: number;
  labor_rate: number;
  markup_pct: number;
  default_coats: number;
  product_line: string | null;
  is_active: boolean;
};

// A line item inside a builder area (stored as jsonb on the estimate).
export type ProposalLine = {
  id: string;
  catalog_item_id: string | null;
  name: string;
  substrate: string;
  unit_basis: UnitBasis;
  measurement: number;          // sqft / linear ft / each / hours
  coats: number;
  // snapshots from the catalog item at add-time
  spread_rate: number;
  cost_of_goods: number;
  labor_rate: number;
  markup_pct: number;
  product_line: string | null;
  manual_total: number | null;  // when set, overrides the computed total (and holds the amount for flat lines)
  optional: boolean;            // customer can toggle this line on/off in the customer view
};

export type Area = {
  id: string;
  name: string;
  hours: number;                // informational labor hours (not added to total)
  prep_note: string;            // "Preparation Grade" banner text
  optional: boolean;            // legacy area-level optional (migrated to line-level in the builder)
  lines: ProposalLine[];
};

export type Addon = {
  id: string;
  name: string;
  description: string;
  total: number;
  included: boolean;            // "Added to Proposal" vs "Not included"
};

export type DepositType = "percent" | "flat";
export type PaymentMethod = "card" | "check";

// A reusable video reference stored on a template (applied to proposals as media).
export type StructureVideo = { id: string; title: string; url: string; source: string };

// The reusable part of a proposal — what a template stores and applies.
export type ProposalStructure = {
  areas: Area[];
  addons: Addon[];
  deposit_type: DepositType;
  deposit_value: number;
  payment_methods: PaymentMethod[];
  project_overview: string | null;
  notes: string | null;
  videos?: StructureVideo[];
};

// Deep-copy a structure with fresh ids so applying a template to a new proposal
// never shares ids with the template (or with another proposal).
export function cloneStructureWithNewIds(s: ProposalStructure): ProposalStructure {
  return {
    ...s,
    areas: (s.areas ?? []).map((a) => ({
      ...a,
      id: crypto.randomUUID(),
      lines: (a.lines ?? []).map((l) => ({ ...l, id: crypto.randomUUID() })),
    })),
    addons: (s.addons ?? []).map((a) => ({ ...a, id: crypto.randomUUID() })),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export function isCoverageBasis(basis: UnitBasis): boolean {
  return basis === "sqft" || basis === "linear_ft";
}

export function computeLineTotal(line: Pick<ProposalLine,
  "unit_basis" | "measurement" | "coats" | "spread_rate" | "cost_of_goods" |
  "labor_rate" | "markup_pct" | "manual_total">): number {
  // Flat lines (fees / discounts) are a plain amount held in manual_total; it may
  // be negative for a discount.
  if (line.unit_basis === "flat") return round2(num(line.manual_total));
  if (line.manual_total != null && Number.isFinite(line.manual_total)) {
    return round2(num(line.manual_total));
  }
  const measurement = num(line.measurement);
  const coats = num(line.coats) > 0 ? num(line.coats) : 1;
  const cogs = num(line.cost_of_goods);
  const labor = num(line.labor_rate);
  const markup = num(line.markup_pct);

  let material = 0;
  let laborCost = 0;
  if (isCoverageBasis(line.unit_basis)) {
    const rate = num(line.spread_rate);
    const unitsNeeded = rate > 0 ? (measurement * coats) / rate : 0;
    material = unitsNeeded * cogs;
    laborCost = measurement * coats * labor;
  } else {
    material = measurement * cogs;
    laborCost = measurement * labor;
  }
  return round2((material + laborCost) * (1 + markup / 100));
}

// A line is optional if it's marked optional, or (legacy) its area is optional.
export function isLineOptional(area: Area, line: ProposalLine): boolean {
  return !!line.optional || !!area.optional;
}

// Convert legacy area-level optional into line-level optional so the builder's
// per-line checkboxes reflect reality.
export function migrateOptionalAreas(areas: Area[]): Area[] {
  return (areas ?? []).map((a) =>
    a.optional
      ? { ...a, optional: false, lines: (a.lines ?? []).map((l) => ({ ...l, optional: true })) }
      : a,
  );
}

// Gross area total — every line, optional or not (shown on the builder).
export function areaTotal(area: Area): number {
  return round2((area.lines ?? []).reduce((s, l) => s + computeLineTotal(l), 0));
}

// Base area total — only the always-included lines.
export function areaBaseTotal(area: Area): number {
  return round2((area.lines ?? []).filter((l) => !isLineOptional(area, l)).reduce((s, l) => s + computeLineTotal(l), 0));
}

// Base proposal price: always-included lines + included add-ons (optional lines
// and non-included add-ons are opt-in on the customer view).
export function estimateTotal(areas: Area[], addons: Addon[]): number {
  const areaSum = (areas ?? []).reduce((s, a) => s + areaBaseTotal(a), 0);
  const addonSum = (addons ?? [])
    .filter((a) => a.included)
    .reduce((s, a) => s + num(a.total), 0);
  return round2(areaSum + addonSum);
}

// Sum of all optional line items across areas (shown to the vendor as a note).
export function optionalLinesTotal(areas: Area[]): number {
  let sum = 0;
  for (const a of areas ?? []) for (const l of a.lines ?? []) if (isLineOptional(a, l)) sum += computeLineTotal(l);
  return round2(sum);
}

// Total for the customer view: always-included lines are in; optional lines and
// add-ons are added only when their id is in the selected sets. Used by both the
// customer view (live) and the deposit API (authoritative recompute).
export function selectedTotal(
  areas: Area[], addons: Addon[],
  selectedLineIds: Set<string>, selectedAddonIds: Set<string>,
): number {
  let sum = 0;
  for (const a of areas ?? []) {
    for (const l of a.lines ?? []) {
      if (!isLineOptional(a, l) || selectedLineIds.has(l.id)) sum += computeLineTotal(l);
    }
  }
  for (const ad of addons ?? []) if (selectedAddonIds.has(ad.id)) sum += num(ad.total);
  return round2(sum);
}

// The add-ons a vendor pre-selected ("Added to Proposal") — the default checked
// state in the customer view.
export function defaultSelectedAddonIds(addons: Addon[]): string[] {
  return (addons ?? []).filter((a) => a.included).map((a) => a.id);
}

// Optional lines default to OFF in the customer view (they're opt-in upsells).
export function defaultSelectedLineIds(): string[] {
  return [];
}

export function depositAmount(total: number, type: DepositType, value: number): number {
  const v = num(value);
  if (type === "flat") return round2(Math.min(v, total));
  return round2((total * v) / 100);
}

// Flatten the area/addon structure into the legacy `line_items` shape
// ({ description, qty, unit_price }) so the existing email / print / list-total
// code keeps working without changes.
export function toFlatLineItems(
  areas: Area[],
  addons: Addon[],
): { id: string; description: string; qty: number; unit_price: number }[] {
  const out: { id: string; description: string; qty: number; unit_price: number }[] = [];
  for (const area of areas ?? []) {
    for (const line of area.lines ?? []) {
      if (isLineOptional(area, line)) continue;  // optional lines are opt-in, not in the base
      const total = computeLineTotal(line);
      const unit = UNIT_LABEL[line.unit_basis] ?? "";
      const detail = line.unit_basis === "flat"
        ? ""
        : isCoverageBasis(line.unit_basis)
          ? ` (${num(line.measurement)} ${unit}${num(line.coats) > 1 ? ` · ${num(line.coats)} coats` : ""})`
          : ` (${num(line.measurement)} ${unit})`;
      out.push({
        id: line.id,
        description: `${area.name ? area.name + " — " : ""}${line.name}${detail}`,
        qty: 1,
        unit_price: total,
      });
    }
  }
  for (const addon of addons ?? []) {
    if (!addon.included) continue;
    out.push({ id: addon.id, description: `Add-on: ${addon.name}`, qty: 1, unit_price: num(addon.total) });
  }
  return out;
}

// ── Builders for fresh rows ──────────────────────────────────────────────────
export function newLineFromCatalog(item: CatalogItem): ProposalLine {
  const flat = item.unit_basis === "flat";
  return {
    id: crypto.randomUUID(),
    catalog_item_id: item.id,
    name: item.name,
    substrate: item.substrate,
    unit_basis: item.unit_basis,
    measurement: 0,
    coats: item.default_coats || 1,
    spread_rate: num(item.spread_rate),
    cost_of_goods: num(item.cost_of_goods),
    labor_rate: num(item.labor_rate),
    markup_pct: num(item.markup_pct),
    product_line: item.product_line,
    // A flat catalog item carries its fixed amount in cost_of_goods.
    manual_total: flat ? num(item.cost_of_goods) : null,
    optional: false,
  };
}

export function newBlankLine(): ProposalLine {
  return {
    id: crypto.randomUUID(),
    catalog_item_id: null,
    name: "",
    substrate: "General",
    unit_basis: "sqft",
    measurement: 0,
    coats: 1,
    spread_rate: 0,
    cost_of_goods: 0,
    labor_rate: 0,
    markup_pct: 0,
    product_line: null,
    manual_total: null,
    optional: false,
  };
}

// A flat "line item" — a typed name + amount (negative = discount).
export function newFlatLine(name = "", amount = 0): ProposalLine {
  return { ...newBlankLine(), unit_basis: "flat", name, manual_total: amount };
}

export function newArea(): Area {
  return {
    id: crypto.randomUUID(),
    name: "New Area",
    hours: 0,
    prep_note: "",
    optional: false,
    lines: [],
  };
}

export function newAddon(): Addon {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    total: 0,
    included: false,
  };
}
