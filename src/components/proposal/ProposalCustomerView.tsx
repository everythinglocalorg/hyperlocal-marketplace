"use client";
import { useMemo, useState } from "react";
import {
  Area, Addon, DepositType, PaymentMethod, UNIT_LABEL, isCoverageBasis,
  computeLineTotal, areaTotal, selectedTotal, depositAmount, defaultSelectedAddonIds,
} from "@/lib/estimate-pricing";
import { renderMarkdown } from "@/lib/markdown";

type Media = { id: string; area_id: string | null; kind: string; source: string; url: string; thumb_url: string | null; caption: string | null; position: number };

export type ProposalData = {
  token: string;
  title: string; status: string;
  areas: Area[]; addons: Addon[];
  depositType: DepositType; depositValue: number; paymentMethods: PaymentMethod[];
  projectOverview: string | null; notes: string | null;
  proposalNumber: string | null; salesperson: string | null;
  createdAt: string; expiresAt: string | null; acceptedAt: string | null; depositPaidAt: string | null;
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null };
  savedSelections: { optional_area_ids?: string[]; addon_ids?: string[] } | null;
  media: Media[];
  vendor: { businessName: string; slug: string | null; logoUrl: string | null; phone: string | null; city: string | null; state: string | null; connectEnabled: boolean };
};

const money = (n: number) => `$${n.toFixed(2)}`;

function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return null;
}

export default function ProposalCustomerView({ data }: { data: ProposalData }) {
  const alreadyAccepted = Boolean(data.acceptedAt) || data.status === "accepted";
  const paid = Boolean(data.depositPaidAt);

  const [optAreas, setOptAreas] = useState<Set<string>>(
    new Set(data.savedSelections?.optional_area_ids ?? []),
  );
  const [addonSel, setAddonSel] = useState<Set<string>>(
    new Set(data.savedSelections?.addon_ids ?? defaultSelectedAddonIds(data.addons)),
  );
  const [busy, setBusy] = useState<null | "card" | "check">(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(alreadyAccepted);

  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const justPaid = query.get("paid") === "1";
  const cancelled = query.get("cancelled") === "1";

  const total = useMemo(() => selectedTotal(data.areas, data.addons, optAreas, addonSel), [data.areas, data.addons, optAreas, addonSel]);
  const deposit = depositAmount(total, data.depositType, data.depositValue);

  const canCard = data.paymentMethods.includes("card") && data.vendor.connectEnabled && deposit >= 0.5;
  const canCheck = data.paymentMethods.includes("check");

  const nonOptional = data.areas.filter((a) => !a.optional);
  const optional = data.areas.filter((a) => a.optional);
  const generalMedia = data.media.filter((m) => !m.area_id).sort((a, b) => a.position - b.position);

  function toggleOptArea(id: string) {
    setOptAreas((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAddon(id: string) {
    setAddonSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function payCard() {
    setError(null); setBusy("card");
    const res = await fetch("/api/proposal/deposit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.token, optionalAreaIds: [...optAreas], addonIds: [...addonSel] }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.location.href = j.url; return; }
    setBusy(null); setError(j.error ?? "Couldn't start the payment. Please try again.");
  }

  async function payCheck() {
    setError(null); setBusy("check");
    if (!window.confirm("Accept this proposal and arrange to pay by check?")) { setBusy(null); return; }
    const res = await fetch("/api/proposal/accept", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.token, optionalAreaIds: [...optAreas], addonIds: [...addonSel], method: "check" }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) { setAccepted(true); return; }
    setError(j.error ?? "Couldn't record your acceptance. Please try again.");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Brand header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-5 flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-green-700 overflow-hidden shrink-0 ${data.vendor.logoUrl ? "bg-white border border-gray-100" : "bg-green-100"}`}>
            {data.vendor.logoUrl ? <img src={data.vendor.logoUrl} alt="" className="w-full h-full object-contain" /> : data.vendor.businessName[0]}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{data.vendor.businessName}</p>
            {(data.vendor.city || data.vendor.phone) && (
              <p className="text-xs text-gray-400 truncate">
                {[data.vendor.city && `${data.vendor.city}${data.vendor.state ? ", " + data.vendor.state : ""}`, data.vendor.phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button onClick={() => window.print()} className="print:hidden ml-auto shrink-0 text-sm font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            ⬇ PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* Status banners */}
        {(paid || justPaid) && (
          <Banner tone="green" title="Deposit received — thank you!" body="Your project is booked. The business will be in touch to schedule." />
        )}
        {!paid && accepted && (
          <Banner tone="green" title="Proposal accepted" body="Thanks! The business has been notified and will follow up about payment and scheduling." />
        )}
        {cancelled && !paid && (
          <Banner tone="amber" title="Payment cancelled" body="No charge was made. You can review and accept again whenever you're ready." />
        )}

        {/* Title / meta */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{data.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {data.proposalNumber ? `Proposal ${data.proposalNumber} · ` : "Proposal · "}
              {new Date(data.createdAt).toLocaleDateString()}
              {data.expiresAt ? ` · Expires ${new Date(data.expiresAt).toLocaleDateString()}` : ""}
              {data.salesperson ? ` · ${data.salesperson}` : ""}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${accepted ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
            {accepted ? "Accepted" : "Pending"}
          </span>
        </div>

        {/* Prepared for */}
        {data.customer.name && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Prepared for</p>
            <p className="font-bold text-gray-900">{data.customer.name}</p>
            {data.customer.address && <p className="text-sm text-gray-500">{data.customer.address}</p>}
            {data.customer.email && <p className="text-sm text-gray-500">{data.customer.email}</p>}
            {data.customer.phone && <p className="text-sm text-gray-500">{data.customer.phone}</p>}
          </div>
        )}

        {/* Project overview */}
        {data.projectOverview && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
            <div className="prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.projectOverview) }} />
          </div>
        )}

        {/* Photos / videos */}
        {generalMedia.length > 0 && (
          <div className="mb-6">
            <MediaGallery media={generalMedia} />
          </div>
        )}

        {/* Included areas */}
        <div className="space-y-4">
          {nonOptional.map((area) => (
            <AreaBlock key={area.id} area={area} media={data.media.filter((m) => m.area_id === area.id)} />
          ))}
        </div>

        {/* Optional areas */}
        {optional.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Optional upgrades</p>
            <div className="space-y-4">
              {optional.map((area) => {
                const selected = optAreas.has(area.id);
                return (
                  <div key={area.id} className={`rounded-2xl border transition-colors ${selected ? "border-green-300 bg-white" : "border-dashed border-gray-300 bg-gray-50"}`}>
                    <button onClick={() => !accepted && toggleOptArea(area.id)} disabled={accepted}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default">
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${selected ? "bg-green-600 border-green-600 text-white" : "border-gray-300"}`}>{selected ? "✓" : ""}</span>
                      <span className="font-semibold text-gray-900 flex-1">{area.name}</span>
                      <span className="text-sm font-bold text-gray-800">{money(areaTotal(area))}</span>
                    </button>
                    {selected && <div className="px-4 pb-3"><AreaLines area={area} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-ons */}
        {data.addons.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add-ons</p>
            <div className="space-y-2">
              {data.addons.map((addon) => {
                const on = addonSel.has(addon.id);
                return (
                  <button key={addon.id} onClick={() => !accepted && toggleAddon(addon.id)} disabled={accepted}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors disabled:cursor-default ${on ? "border-green-300 bg-white" : "border-gray-200 bg-gray-50"}`}>
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? "bg-green-600 border-green-600 text-white" : "border-gray-300"}`}>{on ? "✓" : ""}</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-900 block">{addon.name || "Add-on"}</span>
                      {addon.description && <span className="text-xs text-gray-500 block">{addon.description}</span>}
                    </span>
                    <span className="text-sm font-bold text-gray-800 shrink-0">{addon.total > 0 ? money(addon.total) : "Included"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {data.notes && (
          <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes & Terms</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        )}

        {/* Totals + actions */}
        <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-500">Total</span>
            <span className="text-3xl font-black text-gray-900">{money(total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Deposit due today</span>
            <span className="font-bold text-green-700">{money(deposit)}</span>
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          {!accepted && !paid && (
            <div className="mt-5 space-y-2 print:hidden">
              {canCard && (
                <button onClick={payCard} disabled={busy !== null}
                  className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                  {busy === "card" ? "Redirecting to secure checkout…" : `Accept & Pay ${money(deposit)} Deposit`}
                </button>
              )}
              {canCheck && (
                <button onClick={payCheck} disabled={busy !== null}
                  className={`w-full font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 ${canCard ? "border border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-green-600 text-white hover:bg-green-700"}`}>
                  {busy === "check" ? "Recording…" : "Accept & Pay by Check"}
                </button>
              )}
              {!canCard && !canCheck && (
                <p className="text-sm text-gray-400 text-center">Contact {data.vendor.businessName} to accept this proposal.</p>
              )}
              {data.paymentMethods.includes("card") && !data.vendor.connectEnabled && (
                <p className="text-xs text-amber-600 text-center">Card payment is being set up — please use pay by check or contact the business.</p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 mt-8">Powered by Everything Local</p>
      </div>
    </div>
  );
}

function AreaBlock({ area, media }: { area: Area; media: Media[] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div>
          <p className="font-bold text-gray-900">{area.name}</p>
          {area.hours > 0 && <p className="text-xs text-gray-400">Est. {area.hours} hrs</p>}
        </div>
        <span className="text-sm font-bold text-gray-800">{money(areaTotal(area))}</span>
      </div>
      {area.prep_note && (
        <div className="mx-4 mt-3 text-xs bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-2">{area.prep_note}</div>
      )}
      <div className="px-4 py-3"><AreaLines area={area} /></div>
      {media.length > 0 && <div className="px-4 pb-4"><MediaGallery media={media} /></div>}
    </div>
  );
}

function AreaLines({ area }: { area: Area }) {
  if (!area.lines?.length) return <p className="text-xs text-gray-400">No line items.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {area.lines.map((l) => (
          <tr key={l.id} className="border-b border-gray-50 last:border-0">
            <td className="py-2 pr-2 text-gray-800">
              {l.name}
              <span className="text-gray-400 text-xs block sm:inline sm:ml-2">
                {l.measurement > 0 ? `${l.measurement} ${UNIT_LABEL[l.unit_basis]}` : ""}
                {isCoverageBasis(l.unit_basis) && l.coats > 1 ? ` · ${l.coats} coats` : ""}
              </span>
            </td>
            <td className="py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{money(computeLineTotal(l))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MediaGallery({ media }: { media: Media[] }) {
  const photos = media.filter((m) => m.kind === "photo");
  const videos = media.filter((m) => m.kind === "video");
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener" className="block aspect-square rounded-xl overflow-hidden bg-gray-100">
              <img src={p.thumb_url ?? p.url} alt={p.caption ?? ""} className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {videos.map((v) => {
        const embed = videoEmbed(v.url);
        return embed ? (
          <div key={v.id} className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe src={embed} className="w-full h-full" allow="fullscreen; picture-in-picture" allowFullScreen title={v.caption ?? "Video"} />
          </div>
        ) : (
          <a key={v.id} href={v.url} target="_blank" rel="noopener" className="block text-sm text-green-700 underline">▶ {v.caption ?? "Watch video"}</a>
        );
      })}
    </div>
  );
}

function Banner({ tone, title, body }: { tone: "green" | "amber"; title: string; body: string }) {
  const cls = tone === "green" ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800";
  return (
    <div className={`mb-6 border rounded-2xl p-4 ${cls}`}>
      <p className="font-semibold">{title}</p>
      <p className="text-sm opacity-90">{body}</p>
    </div>
  );
}
