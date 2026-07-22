"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import SignaturePad from "./SignaturePad";

type Duration = { id: string; label: string; hours: number; price: number };

interface Props {
  listing: {
    id: string;
    title: string;
    price?: number | null;
    waiver_url: string | null;
    waiver_filename: string | null;
    waiver_body?: string | null;
    rental_mode?: string | null;      // 'hourly' | 'daily'
    rental_quantity?: number | null;
    rental_buffer_hours?: number | null;
    rental_deposit_type?: string | null;   // 'none' | 'percent' | 'full'
    rental_deposit_value?: number | null;  // percent when type = 'percent'
  };
  vendor: { id: string; business_name: string };
  durations: Duration[];
  currentUser: { id: string; full_name: string | null } | null;
  // "rental" = duration + waiver flow; "service" = date/time appointment (salon, spa, etc.)
  kind?: "rental" | "service";
  onClose: () => void;
}

const TIMES = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
function to12Hour(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
}

// Local (non-UTC) YYYY-MM-DD to avoid timezone off-by-one.
function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function parseDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Inclusive list of day-strings between two dates.
function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  let cur = parseDay(a);
  const end = parseDay(b);
  while (cur <= end) { out.push(fmt(cur)); cur = addDays(cur, 1); }
  return out;
}

export default function RentalBookingModal({ listing, vendor, durations, currentUser, kind = "rental", onClose }: Props) {
  const supabase = createClient();
  const isService = kind === "service";
  // Services are single date/time appointments — never the daily-range flow.
  const isDaily = !isService && (listing.rental_mode ?? "hourly") === "daily";

  const [step, setStep] = useState<"pick" | "waiver" | "confirm" | "done">("pick");
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(durations[0] ?? null);
  const [selectedDate, setSelectedDate] = useState<string>("");     // hourly: the day; daily: range start
  const [rangeEnd, setRangeEnd] = useState<string>("");             // daily only
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Waiver / signature
  const [waiverName, setWaiverName] = useState(currentUser?.full_name ?? "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [scrolledWaiver, setScrolledWaiver] = useState(false);
  const waiverScrollRef = useRef<HTMLDivElement>(null);

  // Availability
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const today = new Date();
  const todayStr = fmt(today);
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const loadAvailability = useCallback(async () => {
    const from = todayStr;
    const to = fmt(addDays(today, 180));
    const { data } = await supabase.rpc("get_rental_unavailable_dates", {
      p_listing_id: listing.id, p_from: from, p_to: to,
    });
    if (Array.isArray(data)) {
      const set = new Set<string>(
        data.map((row: unknown) =>
          typeof row === "string" ? row : String((row as Record<string, unknown>)?.get_rental_unavailable_dates ?? row)
        )
      );
      setUnavailable(set);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);

  // A short waiver may not be scrollable — unlock the signature immediately in that case.
  useEffect(() => {
    if (step !== "waiver") return;
    const el = waiverScrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setScrolledWaiver(true);
  }, [step]);

  const rangeDays = isDaily && selectedDate && rangeEnd ? daysBetween(selectedDate, rangeEnd)
    : selectedDate ? [selectedDate] : [];
  const numDays = rangeDays.length || 1;

  // Services are priced by the listing itself; daily rentals multiply per-day; hourly/flat use the set price.
  const totalPrice = isService
    ? Number(listing.price ?? 0)
    : selectedDuration
    ? (isDaily && selectedDuration.hours <= 24 ? selectedDuration.price * numDays : selectedDuration.price)
    : 0;

  // Card deposit config (charged at booking via Stripe Connect).
  const depositType = listing.rental_deposit_type ?? "none";
  const depositValue = Number(listing.rental_deposit_value ?? 0);
  const depositDue = depositType === "full" ? totalPrice
    : depositType === "percent" ? Math.round(totalPrice * (depositValue / 100) * 100) / 100
    : 0;

  function onDayClick(dateStr: string) {
    setError("");
    if (!isDaily) { setSelectedDate(dateStr); return; }

    // Daily range selection
    if (!selectedDate || rangeEnd) {
      setSelectedDate(dateStr); setRangeEnd("");
      return;
    }
    if (dateStr < selectedDate) { setSelectedDate(dateStr); setRangeEnd(""); return; }
    if (dateStr === selectedDate) { setRangeEnd(dateStr); return; }
    // Reject a range that crosses any unavailable day.
    const span = daysBetween(selectedDate, dateStr);
    if (span.some((d) => unavailable.has(d))) {
      setError("That range includes an unavailable date. Pick a range with all-open days.");
      return;
    }
    setRangeEnd(dateStr);
  }

  function renderCalendar() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const monthName = calMonth.toLocaleString("default", { month: "long", year: "numeric" });

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">◀</button>
          <span className="text-sm font-semibold text-gray-700">{monthName}</span>
          <button type="button" onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
            <div key={d} className="text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isPast = dateStr < todayStr;
            const isUnavailable = unavailable.has(dateStr);
            const inRange = isDaily && selectedDate && rangeEnd && dateStr >= selectedDate && dateStr <= rangeEnd;
            const isSelected = dateStr === selectedDate || dateStr === rangeEnd || inRange;
            const disabled = isPast || isUnavailable;

            let cls = "hover:bg-green-50 text-gray-700 hover:text-green-700 bg-green-50/40";
            if (isSelected) cls = "bg-green-600 text-white font-bold";
            else if (isPast) cls = "text-gray-300 cursor-not-allowed";
            else if (isUnavailable) cls = "bg-red-50 text-red-300 line-through cursor-not-allowed";

            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                title={isUnavailable ? "Unavailable" : undefined}
                onClick={() => onDayClick(dateStr)}
                className={`h-8 w-full rounded-lg text-sm transition-colors ${cls}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-200" /> Available</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" /> In use</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-600" /> Selected</span>
        </div>
      </div>
    );
  }

  const hasWaiverDoc = !!listing.waiver_url || !!(listing.waiver_body && listing.waiver_body.trim());
  // Rentals always take a waiver; services only when the vendor attached one.
  const needsWaiver = !isService || hasWaiverDoc;
  const canContinuePick = isService
    ? !!selectedDate
    : !!selectedDuration && !!selectedDate && (!isDaily || !!rangeEnd);
  const canSign = scrolledWaiver && !!waiverName.trim() && !!signatureDataUrl;

  async function submitBooking() {
    if (!currentUser || !selectedDate) return;
    if (!isService && !selectedDuration) return;
    if (needsWaiver && !canSign) { setError("Please read the waiver and add your signature."); return; }
    setSubmitting(true);
    setError("");

    const endDate = isDaily ? (rangeEnd || selectedDate) : selectedDate;

    // Race-safe insert with server-side availability re-validation. Services have
    // no rental duration — pass the service name + a nominal 1h to satisfy the schema.
    const { data: bookingId, error: rpcErr } = await supabase.rpc("create_rental_booking", {
      p_listing_id: listing.id,
      p_duration_id: selectedDuration?.id ?? null,
      p_duration_label: selectedDuration?.label ?? listing.title,
      p_duration_hours: selectedDuration?.hours ?? 1,
      p_total_price: totalPrice,
      p_start_date: selectedDate,
      p_start_time: isDaily ? "00:00" : selectedTime,
      p_end_date: endDate,
      p_notes: notes.trim() || null,
      p_waiver_signer_name: (waiverName.trim() || currentUser.full_name || "").trim(),
    });

    if (rpcErr || !bookingId) {
      if (rpcErr?.message?.includes("DATE_UNAVAILABLE")) {
        setError("Sorry — one of those dates was just booked. Please choose another.");
        await loadAvailability();
        setStep("pick");
      } else {
        setError("Booking failed. Please try again.");
      }
      setSubmitting(false);
      return;
    }

    // Generate + store the signed waiver PDF (best-effort — booking already exists).
    // Only when an actual signature was captured (services without a waiver skip this).
    if (signatureDataUrl) try {
      const res = await fetch("/api/rental/sign-waiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          signatureDataUrl,
          signerName: waiverName.trim(),
          listingTitle: listing.title,
          waiverBody: listing.waiver_body ?? null,
          waiverUrl: listing.waiver_url ?? null,
        }),
      });
      if (!res.ok) console.warn("Waiver PDF generation failed:", await res.text());
    } catch (e) {
      console.warn("Waiver PDF request error:", e);
    }

    // Notify the vendor by email (non-blocking).
    fetch("/api/booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: vendor.id,
        customerName: currentUser.full_name ?? "A customer",
        listingTitle: listing.title,
        date: new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + (isDaily && rangeEnd && rangeEnd !== selectedDate ? ` – ${new Date(rangeEnd + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""),
        time: isDaily ? "All day" : to12Hour(selectedTime),
        duration: isService ? listing.title : isDaily ? `${numDays} day${numDays > 1 ? "s" : ""} (${selectedDuration?.label ?? ""})` : `${selectedDuration?.label ?? ""} (${selectedDuration?.hours ?? 0}h)`,
        price: `$${totalPrice.toFixed(2)}`,
        notes: notes.trim() || null,
      }),
    }).catch(() => {});

    // If the vendor takes a card deposit, hand off to Stripe Checkout. The route
    // recomputes the amount and returns { skip: true } when nothing is due or the
    // vendor isn't set up for cards — in which case we just show the pending screen.
    if (depositType === "percent" || depositType === "full") {
      try {
        const res = await fetch("/api/rental/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json().catch(() => ({}));
        if (json?.url) { window.location.href = json.url; return; }
      } catch (e) {
        console.warn("Rental deposit request error:", e);
      }
    }

    setStep("done");
    setSubmitting(false);
  }

  const dateLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"long", day:"numeric" })
      + (isDaily && rangeEnd && rangeEnd !== selectedDate ? ` – ${new Date(rangeEnd + "T12:00:00").toLocaleDateString("en-US", { month:"long", day:"numeric" })}` : "")
    : "";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{isService ? "Book Now" : "Book a Rental"}</h2>
            <p className="text-xs text-gray-400">{listing.title} · {vendor.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-5">

          {/* ── Step 1: Pick ── */}
          {step === "pick" && (
            <div className="space-y-5">
              {isService ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-gray-800">{listing.title}</span>
                  {Number(listing.price ?? 0) > 0 && (
                    <span className="font-bold text-green-700">${Number(listing.price).toFixed(2)}</span>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Duration</label>
                  {durations.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No durations set up yet by the business.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {durations.map((d) => (
                        <button key={d.id} type="button" onClick={() => setSelectedDuration(d)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                            selectedDuration?.id === d.id
                              ? "bg-green-50 border-green-400 text-green-800"
                              : "border-gray-200 text-gray-700 hover:border-green-300"
                          }`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{d.label}</span>
                            <span className="text-gray-400 text-xs">({d.hours}h)</span>
                          </div>
                          <span className="font-bold text-green-700">${Number(d.price).toFixed(2)}{isDaily && d.hours <= 24 ? "/day" : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {isDaily ? "Select Dates (start & end)" : "Select Date"}
                </label>
                <div className="border border-gray-200 rounded-xl p-3">
                  {renderCalendar()}
                </div>
                {isDaily && selectedDate && (
                  <p className="text-xs text-gray-500 mt-2">
                    {rangeEnd ? `${numDays} day${numDays > 1 ? "s" : ""} selected` : "Now pick an end date (or tap the same day for one day)."}
                  </p>
                )}
              </div>

              {!isDaily && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Start Time</label>
                  <div className="flex flex-wrap gap-2">
                    {TIMES.map((t) => (
                      <button key={t} type="button" onClick={() => setSelectedTime(t)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selectedTime === t ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"
                        }`}>
                        {to12Hour(t)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special requests or questions..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="button"
                disabled={!canContinuePick}
                onClick={() => { setError(""); setStep(needsWaiver ? "waiver" : "confirm"); }}
                className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
                {needsWaiver ? "Continue to Waiver →" : "Review Booking →"}
              </button>
            </div>
          )}

          {/* ── Step 2: Waiver + signature ── */}
          {step === "waiver" && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Rental Waiver & Agreement</h3>
                <p className="text-xs text-gray-500 mb-3">Scroll through the full waiver, then sign below.</p>

                {listing.waiver_url && /\.pdf($|\?)/i.test(listing.waiver_url) && (
                  <iframe
                    src={listing.waiver_url}
                    title="Waiver document"
                    className="w-full h-56 rounded-lg border border-gray-200 mb-3 bg-white"
                    onLoad={() => setScrolledWaiver(true)}
                  />
                )}
                {listing.waiver_url && !/\.pdf($|\?)/i.test(listing.waiver_url) && (
                  <a href={listing.waiver_url} target="_blank" rel="noopener noreferrer"
                    className="inline-block text-sm text-green-700 font-semibold hover:underline mb-3">
                    📄 View Waiver Document ({listing.waiver_filename ?? "waiver"})
                  </a>
                )}

                <div
                  ref={waiverScrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledWaiver(true);
                  }}
                  className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto"
                >
                  {listing.waiver_body && listing.waiver_body.trim() ? (
                    <p className="whitespace-pre-wrap">{listing.waiver_body}</p>
                  ) : (
                    <>
                      <p className="font-semibold mb-1">Standard Rental Terms:</p>
                      <p>By signing below, I agree to use the rented item(s) responsibly and return them in the same condition. I acknowledge that I am responsible for any damage, loss, or theft during the rental period. I understand that failure to return items on time may result in additional fees. I release {vendor.business_name} from liability for any injury or damage arising from the use of rented equipment, except where prohibited by law.</p>
                    </>
                  )}
                </div>
                {!scrolledWaiver && hasWaiverDoc && (
                  <p className="text-[11px] text-amber-600 mt-2">↓ Please scroll to the end of the waiver to enable signing.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Full Name</label>
                <input type="text" value={waiverName} onChange={(e) => setWaiverName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Signature</label>
                <SignaturePad
                  typedName={waiverName}
                  onNameChange={setWaiverName}
                  onSignatureChange={setSignatureDataUrl}
                  disabled={!scrolledWaiver}
                />
                <p className="text-[11px] text-gray-400 mt-2">
                  By signing you agree this is a legally binding electronic signature.
                </p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("pick")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
                <button type="button" onClick={() => { if (!canSign) { setError("Please read the waiver and add your signature."); return; } setError(""); setStep("confirm"); }}
                  disabled={!canSign}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                  Review Booking →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === "confirm" && (isService || selectedDuration) && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900 text-sm mb-3">Booking Summary</h3>
                {[
                  [isService ? "Service" : "Listing", listing.title],
                  ...(isService ? [] as [string,string][] : [["Duration", isDaily ? `${numDays} day${numDays > 1 ? "s" : ""} (${selectedDuration?.label ?? ""})` : `${selectedDuration?.label ?? ""} (${selectedDuration?.hours ?? 0}h)`] as [string,string]]),
                  [isDaily ? "Dates" : "Date", dateLabel],
                  ...(isDaily ? [] as [string,string][] : [["Start time", to12Hour(selectedTime)] as [string,string]]),
                  ...(waiverName.trim() ? [["Signed by", waiverName] as [string,string]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
                {notes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Notes</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{notes}</span>
                  </div>
                )}
                {totalPrice > 0 ? (
                  <div className="border-t border-gray-200 pt-3 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-green-700 text-lg">${totalPrice.toFixed(2)}</span>
                  </div>
                ) : isService ? (
                  <div className="border-t border-gray-200 pt-3">
                    <span className="text-xs text-gray-500">{vendor.business_name} will confirm pricing when they accept your appointment.</span>
                  </div>
                ) : null}
                {depositDue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{depositType === "full" ? "Due now (card)" : `Deposit due now (${depositValue}%)`}</span>
                    <span className="font-bold text-gray-900">${depositDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center">
                {depositDue > 0
                  ? `You'll pay $${depositDue.toFixed(2)} now by card${depositType === "full" ? "" : ` (deposit); the balance is due to ${vendor.business_name}`}. This booking is pending until ${vendor.business_name} confirms.`
                  : `Payment is collected by ${vendor.business_name} directly. This booking is pending until they confirm.`}
              </p>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("waiver")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
                <button type="button" onClick={submitBooking} disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                  {submitting ? "Submitting..." : depositDue > 0 ? `Confirm & Pay $${depositDue.toFixed(2)} →` : "Confirm Booking ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Booking Requested!</h3>
              <p className="text-sm text-gray-500 mb-1">{vendor.business_name} will confirm your booking shortly.</p>
              {signatureDataUrl && waiverName.trim()
                ? <p className="text-xs text-gray-400 mb-6">Your signed waiver was submitted as <strong>{waiverName}</strong>. You can download it from your dashboard.</p>
                : <p className="text-xs text-gray-400 mb-6">You&apos;ll see this booking in your dashboard.</p>}
              <button onClick={onClose} className="bg-green-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-green-700 transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
