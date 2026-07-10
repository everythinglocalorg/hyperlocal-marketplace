"use client";
import { useState } from "react";
import {
  CatalogItem, Substrate, Area, Addon, ProposalLine, DepositType, PaymentMethod, ProposalStructure, StructureVideo,
  UNIT_LABEL, UnitBasis, computeLineTotal, billableUnits, areaTotal, estimateTotal, depositAmount,
  isLineOptional, optionalLinesTotal, newArea, newAddon, newLineFromCatalog, newLineFromSubstrate, newBlankLine, newFlatLine,
} from "@/lib/estimate-pricing";

type Snippet = { id: string; kind: "snippet" | "note"; title: string; body: string };
type LibraryVideo = { id: string; title: string; url: string; source: string };

// The shared editing surface for a proposal/template body: areas + pricing,
// add-ons, text & notes (with snippet insert), deposit + payment, and (template
// mode only) a reusable videos section. Proposals keep their own ProposalMedia
// for per-job photos/videos, so `showVideos` is off there.
export default function ProposalStructureEditor({
  value, onChange, catalog, snippets, substrates = [], videoLibrary = [], showVideos = false, totalLabel = "Total",
}: {
  value: ProposalStructure;
  onChange: (next: ProposalStructure) => void;
  catalog: CatalogItem[];
  snippets: Snippet[];
  substrates?: Substrate[];
  videoLibrary?: LibraryVideo[];
  showVideos?: boolean;
  totalLabel?: string;
}) {
  const areas = value.areas ?? [];
  const addons = value.addons ?? [];
  const videos = value.videos ?? [];

  function set(patch: Partial<ProposalStructure>) { onChange({ ...value, ...patch }); }

  // Areas / lines
  const updateArea = (id: string, p: Partial<Area>) => set({ areas: areas.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const removeArea = (id: string) => set({ areas: areas.filter((a) => a.id !== id) });
  const addArea = () => set({ areas: [...areas, newArea()] });
  const updateLine = (areaId: string, lineId: string, p: Partial<ProposalLine>) =>
    set({ areas: areas.map((a) => (a.id !== areaId ? a : { ...a, lines: a.lines.map((l) => (l.id === lineId ? { ...l, ...p } : l)) })) });
  const addLine = (areaId: string, line: ProposalLine) =>
    set({ areas: areas.map((a) => (a.id === areaId ? { ...a, lines: [...a.lines, line] } : a)) });
  const removeLine = (areaId: string, lineId: string) =>
    set({ areas: areas.map((a) => (a.id === areaId ? { ...a, lines: a.lines.filter((l) => l.id !== lineId) } : a)) });
  const duplicateLine = (areaId: string, lineId: string) =>
    set({ areas: areas.map((a) => {
      if (a.id !== areaId) return a;
      const idx = a.lines.findIndex((l) => l.id === lineId);
      if (idx < 0) return a;
      const copy = { ...a.lines[idx], id: crypto.randomUUID() };
      return { ...a, lines: [...a.lines.slice(0, idx + 1), copy, ...a.lines.slice(idx + 1)] };
    }) });

  // Add-ons
  const updateAddon = (id: string, p: Partial<Addon>) => set({ addons: addons.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const removeAddon = (id: string) => set({ addons: addons.filter((a) => a.id !== id) });

  // Videos (template mode)
  const addVideo = (v: { title: string; url: string; source: string }) =>
    set({ videos: [...videos, { id: crypto.randomUUID(), ...v }] });
  const removeVideo = (id: string) => set({ videos: videos.filter((v) => v.id !== id) });

  function insertSnippet(field: "project_overview" | "notes", body: string) {
    const current = (value[field] ?? "").trim();
    set({ [field]: current ? `${current}\n\n${body}` : body } as Partial<ProposalStructure>);
  }

  const total = estimateTotal(areas, addons);
  const optionalTotal = optionalLinesTotal(areas);
  const deposit = depositAmount(total, value.deposit_type, value.deposit_value);

  return (
    <div>
      {catalog.length === 0 && (
        <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2">
          Tip: set up your <strong>Price Book</strong> to add products with one click and auto-calculate totals. You can also add custom lines below.
        </div>
      )}

      {/* Areas */}
      <div className="space-y-4">
        {areas.map((area) => (
          <AreaCard key={area.id} area={area} catalog={catalog} substrates={substrates}
            onUpdate={(p) => updateArea(area.id, p)}
            onRemove={() => removeArea(area.id)}
            onAddLine={(line) => addLine(area.id, line)}
            onUpdateLine={(lineId, p) => updateLine(area.id, lineId, p)}
            onRemoveLine={(lineId) => removeLine(area.id, lineId)}
            onDuplicateLine={(lineId) => duplicateLine(area.id, lineId)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={addArea} className="text-sm font-semibold text-green-700 border border-green-200 px-4 py-2 rounded-xl hover:bg-green-50 transition-colors">+ Add Area</button>
      </div>

      {/* Add-ons */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Optional Add-ons</p>
          <button onClick={() => set({ addons: [...addons, newAddon()] })} className="text-xs text-green-600 hover:underline font-semibold">+ Add add-on</button>
        </div>
        {addons.length === 0 ? (
          <p className="text-xs text-gray-400">Warranties, upgrades, extras the customer can opt into.</p>
        ) : (
          <div className="space-y-2">
            {addons.map((addon) => (
              <div key={addon.id} className="grid grid-cols-12 gap-2 items-center bg-white border border-gray-100 rounded-xl p-3">
                <input value={addon.name} onChange={(e) => updateAddon(addon.id, { name: e.target.value })} placeholder="e.g. 3-yr workmanship warranty"
                  className="col-span-12 sm:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <input value={addon.description} onChange={(e) => updateAddon(addon.id, { description: e.target.value })} placeholder="Short description"
                  className="col-span-7 sm:col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <div className="col-span-3 sm:col-span-2 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={addon.total} onChange={(e) => updateAddon(addon.id, { total: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button onClick={() => updateAddon(addon.id, { included: !addon.included })}
                  className={`col-span-2 sm:col-span-2 text-xs font-semibold px-2 py-2 rounded-lg transition-colors ${addon.included ? "bg-green-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {addon.included ? "Added" : "Not incl."}
                </button>
                <button onClick={() => removeAddon(addon.id)} className="hidden sm:block col-span-12 sm:col-span-0 text-gray-300 hover:text-red-400 text-center">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos (template mode) */}
      {showVideos && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Videos</p>
          <VideoPicker library={videoLibrary} onAdd={addVideo} />
          {videos.length === 0 ? (
            <p className="text-xs text-gray-400 mt-2">Add a walkthrough or intro video — it shows on every proposal made from this template.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <span className="text-lg shrink-0">🎬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{v.title || "Video"}</p>
                    <a href={v.url} target="_blank" rel="noopener" className="text-xs text-green-700 hover:underline truncate block">{v.url}</a>
                  </div>
                  <button onClick={() => removeVideo(v.id)} className="text-gray-300 hover:text-red-400 text-sm shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project overview / notes */}
      <div className="mt-6 grid grid-cols-1 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Project overview</span>
            <SnippetInsert snippets={snippets.filter((s) => s.kind === "snippet")} onInsert={(b) => insertSnippet("project_overview", b)} />
          </div>
          <textarea rows={3} value={value.project_overview ?? ""} onChange={(e) => set({ project_overview: e.target.value })}
            placeholder="Scope, colors selected, timeframe, key highlights… (Markdown + links supported)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes / Terms</span>
            <SnippetInsert snippets={snippets.filter((s) => s.kind === "note")} onInsert={(b) => insertSnippet("notes", b)} />
          </div>
          <textarea rows={2} value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Payment terms, expiry date…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
      </div>

      {/* Totals + deposit */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">{totalLabel}</span>
          <span className="text-2xl font-bold text-green-700">${total.toFixed(2)}</span>
        </div>
        {optionalTotal !== 0 && (
          <p className="text-xs text-gray-400 text-right mb-3">+ ${optionalTotal.toFixed(2)} in optional items the customer can add</p>
        )}

        <div className="mt-3 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deposit</p>
          <div className="flex flex-wrap items-center gap-2">
            <DepositChip active={value.deposit_type === "percent" && value.deposit_value === 50} onClick={() => set({ deposit_type: "percent", deposit_value: 50 })}>50%</DepositChip>
            <DepositChip active={value.deposit_type === "percent" && value.deposit_value === 100} onClick={() => set({ deposit_type: "percent", deposit_value: 100 })}>100%</DepositChip>
            <div className="flex items-center gap-1.5 ml-1">
              <select value={value.deposit_type} onChange={(e) => set({ deposit_type: e.target.value as DepositType })}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="percent">Custom %</option>
                <option value="flat">Flat $</option>
              </select>
              <input type="number" min={0} step="0.01" value={value.deposit_value}
                onChange={(e) => set({ deposit_value: Number(e.target.value) })}
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <span className="ml-auto text-sm text-gray-600">Deposit due: <strong className="text-gray-900">${deposit.toFixed(2)}</strong></span>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Customer can pay by</p>
          <div className="flex gap-2">
            <PayToggle active={value.payment_methods.includes("card")} onClick={() => togglePay("card")}>💳 Card</PayToggle>
            <PayToggle active={value.payment_methods.includes("check")} onClick={() => togglePay("check")}>🧾 Check</PayToggle>
          </div>
        </div>
      </div>
    </div>
  );

  function togglePay(m: PaymentMethod) {
    const has = value.payment_methods.includes(m);
    set({ payment_methods: has ? value.payment_methods.filter((x) => x !== m) : [...value.payment_methods, m] });
  }
}

function VideoPicker({ library, onAdd }: { library: LibraryVideo[]; onAdd: (v: { title: string; url: string; source: string }) => void }) {
  const [url, setUrl] = useState("");
  const detect = (u: string) => /youtube\.com|youtu\.be/.test(u) ? "youtube" : /vimeo\.com/.test(u) ? "vimeo" : /loom\.com/.test(u) ? "loom" : "url";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {library.length > 0 && (
        <select value="" onChange={(e) => { const v = library.find((x) => x.id === e.target.value); if (v) onAdd({ title: v.title, url: v.url, source: v.source }); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">🎬 Add from library…</option>
          {library.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
      )}
      <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { onAdd({ title: url.trim(), url: url.trim(), source: detect(url) }); setUrl(""); } }}
          placeholder="Or paste a YouTube / Vimeo / Loom link"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <button onClick={() => { if (url.trim()) { onAdd({ title: url.trim(), url: url.trim(), source: detect(url) }); setUrl(""); } }} disabled={!url.trim()}
          className="text-sm text-green-700 border border-green-200 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

// ── Area card ────────────────────────────────────────────────────────────────
function AreaCard({ area, catalog, substrates, onUpdate, onRemove, onAddLine, onUpdateLine, onRemoveLine, onDuplicateLine }: {
  area: Area; catalog: CatalogItem[]; substrates: Substrate[];
  onUpdate: (p: Partial<Area>) => void; onRemove: () => void;
  onAddLine: (line: ProposalLine) => void;
  onUpdateLine: (lineId: string, p: Partial<ProposalLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onDuplicateLine: (lineId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = areaTotal(area);

  return (
    <div className="border rounded-2xl border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={() => setCollapsed((c) => !c)} className="text-gray-400 hover:text-gray-600 text-sm w-4">{collapsed ? "▸" : "▾"}</button>
        <input value={area.name} onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-semibold text-gray-900 bg-transparent focus:outline-none flex-1 min-w-0 border-b border-transparent focus:border-green-300" />
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input type="number" min={0} step="0.5" value={area.hours} onChange={(e) => onUpdate({ hours: Number(e.target.value) })}
            className="w-14 border border-gray-200 rounded px-1.5 py-1 text-right focus:outline-none focus:ring-1 focus:ring-green-500" /> hrs
        </label>
        <span className="text-sm font-bold text-gray-800 w-24 text-right">${total.toFixed(2)}</span>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
      </div>

      {!collapsed && (
        <div className="px-4 py-3">
          <input value={area.prep_note} onChange={(e) => onUpdate({ prep_note: e.target.value })}
            placeholder="Preparation grade / prep notes (shown as a banner to the customer)…"
            className="w-full text-xs bg-amber-50 border border-amber-100 text-amber-800 placeholder-amber-400 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-300" />

          {area.lines.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                <span className="col-span-5">Item</span>
                <span className="col-span-3 text-center">Measurement</span>
                <span className="col-span-2 text-right">Total</span>
                <span className="col-span-1 text-center">Opt</span>
                <span className="col-span-1" />
              </div>
              {area.lines.map((line) => (
                <LineRow key={line.id} line={line} onUpdate={(p) => onUpdateLine(line.id, p)} onRemove={() => onRemoveLine(line.id)} onDuplicate={() => onDuplicateLine(line.id)} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {catalog.length > 0 && (
              <select value="" onChange={(e) => { const item = catalog.find((c) => c.id === e.target.value); if (item) onAddLine(newLineFromCatalog(item)); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">+ Add item from price book…</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.substrate} · {c.name}{c.unit_basis === "flat" ? " ($)" : ""}</option>)}
              </select>
            )}
            {substrates.length > 0 && (
              <select value="" onChange={(e) => { const s = substrates.find((x) => x.id === e.target.value); if (s) onAddLine(newLineFromSubstrate(s)); }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">+ Add labor (substrate)…</option>
                {substrates.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button onClick={() => onAddLine(newBlankLine())} className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">+ Custom line</button>
            <button onClick={() => onAddLine(newFlatLine())} className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">+ Add line item</button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Use <strong>+ Add line item</strong> for flat charges or discounts (enter a negative amount). Check <strong>Opt</strong> to let the customer toggle a line on the proposal.</p>
        </div>
      )}
    </div>
  );
}

// ── Line row ─────────────────────────────────────────────────────────────────
function LineRow({ line, onUpdate, onRemove, onDuplicate }: {
  line: ProposalLine; onUpdate: (p: Partial<ProposalLine>) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const flat = line.unit_basis === "flat";
  const computed = computeLineTotal({ ...line, manual_total: null });
  const total = computeLineTotal(line);
  const overridden = !flat && line.manual_total != null;

  const optCheck = (
    <label className="col-span-2 sm:col-span-1 flex items-center justify-center" title="Optional — the customer can toggle this line on the proposal">
      <input type="checkbox" checked={!!line.optional} onChange={(e) => onUpdate({ optional: e.target.checked })} className="w-4 h-4 accent-green-600" />
    </label>
  );
  const removeCol = (
    <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1.5">
      {overridden && <button onClick={() => onUpdate({ manual_total: null })} title="Reset to auto" className="text-gray-300 hover:text-green-500 text-xs">↺</button>}
      <button onClick={onDuplicate} title="Duplicate line" className="text-gray-300 hover:text-green-600 text-sm">⧉</button>
      <button onClick={onRemove} title="Remove line" className="text-gray-300 hover:text-red-400 text-sm">✕</button>
    </div>
  );

  if (flat) {
    return (
      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-8 sm:col-span-8">
          <input value={line.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="e.g. Discount, Permit fee, Senior discount"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="col-span-4 sm:col-span-2 relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input type="number" step="0.01" value={line.manual_total ?? 0}
            onChange={(e) => onUpdate({ manual_total: e.target.value === "" ? 0 : Number(e.target.value) })}
            title="Amount — use a negative number for a discount"
            className={`w-full border border-gray-200 rounded-lg pl-5 pr-1 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500 ${total < 0 ? "text-red-600" : ""}`} />
        </div>
        {optCheck}
        {removeCol}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-12 sm:col-span-5">
        <input value={line.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Item name"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        {line.unit_basis === "linear_ft" && (
          <div className="flex items-center gap-1.5 mt-1 px-1">
            <span className="text-[11px] text-gray-400">Width</span>
            <input type="number" min={0} step="0.25" value={line.width_inches || ""}
              onChange={(e) => onUpdate({ width_inches: e.target.value === "" ? 0 : Number(e.target.value) })}
              placeholder="in" className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-500" />
            <span className="text-[11px] text-gray-400">in{line.width_inches > 0 && line.measurement > 0 ? ` → ${Math.round(billableUnits(line))} sq ft` : ""}</span>
          </div>
        )}
        {line.unit_basis !== "linear_ft" && (line.product_line || line.catalog_item_id) && (
          <p className="text-[11px] text-gray-400 mt-0.5 px-1 truncate">{line.product_line ?? "Custom"} · {UNIT_LABEL[line.unit_basis]}</p>
        )}
      </div>
      <div className="col-span-6 sm:col-span-3 flex items-center gap-1">
        <input type="number" min={0} step="0.01" value={line.measurement} onChange={(e) => onUpdate({ measurement: Number(e.target.value) })}
          className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
        {!line.catalog_item_id ? (
          <select value={line.unit_basis} onChange={(e) => onUpdate({ unit_basis: e.target.value as UnitBasis })}
            className="border border-gray-200 rounded-lg px-1 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500">
            {(["sqft", "linear_ft", "each", "hour"] as UnitBasis[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        ) : (
          <span className="text-xs text-gray-400 w-14 shrink-0">{UNIT_LABEL[line.unit_basis]}</span>
        )}
      </div>
      <div className="col-span-4 sm:col-span-2 relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input type="number" min={0} step="0.01" value={total}
          onChange={(e) => onUpdate({ manual_total: e.target.value === "" ? null : Number(e.target.value) })}
          title={overridden ? `Manual override (auto: $${computed.toFixed(2)})` : "Auto-calculated from your price book — edit to override"}
          className={`w-full border rounded-lg pl-5 pr-1 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500 ${overridden ? "border-amber-300 bg-amber-50" : "border-gray-200"}`} />
      </div>
      {optCheck}
      {removeCol}
    </div>
  );
}

function SnippetInsert({ snippets, onInsert }: {
  snippets: { id: string; title: string; body: string }[]; onInsert: (body: string) => void;
}) {
  if (snippets.length === 0) return null;
  return (
    <select value="" onChange={(e) => { const s = snippets.find((x) => x.id === e.target.value); if (s) onInsert(s.body); }}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500">
      <option value="">+ Insert snippet…</option>
      {snippets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
    </select>
  );
}

function DepositChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${active ? "bg-green-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{children}</button>;
}

function PayToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${active ? "bg-green-50 border border-green-300 text-green-700" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{children}</button>;
}
