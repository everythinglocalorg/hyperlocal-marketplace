"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Duration = { id: string; label: string; hours: number; price: number };

interface Props {
  listing: { id: string; title: string; waiver_url: string | null; waiver_filename: string | null };
  vendor: { id: string; business_name: string };
  durations: Duration[];
  currentUser: { id: string; full_name: string | null } | null;
  onClose: () => void;
}

const TIMES = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
function to12Hour(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,"0")} ${ampm}`;
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export default function RentalBookingModal({ listing, vendor, durations, currentUser, onClose }: Props) {
  const supabase = createClient();

  const [step, setStep] = useState<"pick" | "waiver" | "confirm" | "done">("pick");
  const [selectedDuration, setSelectedDuration] = useState<Duration | null>(durations[0] ?? null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [waiverChecked, setWaiverChecked] = useState(false);
  const [waiverName, setWaiverName] = useState(currentUser?.full_name ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Calendar state — show current + next month
  const today = new Date();
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function renderCalendar() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const monthName = calMonth.toLocaleString("default", { month: "long", year: "numeric" });
    const todayStr = toDateStr(today);

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">◀</button>
          <span className="text-sm font-semibold text-gray-700">{monthName}</span>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-500">▶</button>
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
            const isSelected = dateStr === selectedDate;
            return (
              <button key={i} disabled={isPast}
                onClick={() => setSelectedDate(dateStr)}
                className={`h-8 w-full rounded-lg text-sm transition-colors ${
                  isSelected ? "bg-green-600 text-white font-bold" :
                  isPast ? "text-gray-300 cursor-not-allowed" :
                  "hover:bg-green-50 text-gray-700 hover:text-green-700"
                }`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  async function submitBooking() {
    if (!currentUser || !selectedDuration || !selectedDate) return;
    if (!waiverChecked || !waiverName.trim()) { setError("Please sign the waiver to continue."); return; }
    setSubmitting(true);
    setError("");

    // Calculate end date based on hours
    const startDt = new Date(`${selectedDate}T${selectedTime}:00`);
    const endDt = new Date(startDt.getTime() + selectedDuration.hours * 3600000);
    const endDate = toDateStr(endDt);

    const { error: err } = await supabase.from("rental_bookings").insert({
      listing_id: listing.id,
      vendor_id: vendor.id,
      customer_id: currentUser.id,
      duration_id: selectedDuration.id,
      duration_label: selectedDuration.label,
      duration_hours: selectedDuration.hours,
      total_price: selectedDuration.price,
      start_date: selectedDate,
      start_time: selectedTime,
      end_date: endDate,
      status: "pending",
      waiver_signed: true,
      waiver_signer_name: waiverName.trim(),
      waiver_signed_at: new Date().toISOString(),
      notes: notes.trim() || null,
    });

    if (err) { setError("Booking failed. Please try again."); setSubmitting(false); return; }

    // Fire email to vendor (non-blocking — don't fail booking if email fails)
    fetch("/api/booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: vendor.id,
        customerName: currentUser.full_name ?? "A customer",
        listingTitle: listing.title,
        date: new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        time: to12Hour(selectedTime),
        duration: `${selectedDuration.label} (${selectedDuration.hours}h)`,
        price: `$${Number(selectedDuration.price).toFixed(2)}`,
        notes: notes.trim() || null,
      }),
    }).catch(() => {});

    setStep("done");
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Book a Rental</h2>
            <p className="text-xs text-gray-400">{listing.title} · {vendor.business_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-6 py-5">

          {/* ── Step 1: Pick date/time/duration ── */}
          {step === "pick" && (
            <div className="space-y-5">
              {/* Duration selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Duration</label>
                {durations.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No durations set up yet by the vendor.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {durations.map((d) => (
                      <button key={d.id} onClick={() => setSelectedDuration(d)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                          selectedDuration?.id === d.id
                            ? "bg-green-50 border-green-400 text-green-800"
                            : "border-gray-200 text-gray-700 hover:border-green-300"
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{d.label}</span>
                          <span className="text-gray-400 text-xs">({d.hours}h)</span>
                        </div>
                        <span className="font-bold text-green-700">${Number(d.price).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Date</label>
                <div className="border border-gray-200 rounded-xl p-3">
                  {renderCalendar()}
                </div>
              </div>

              {/* Start time */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Start Time</label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((t) => (
                    <button key={t} onClick={() => setSelectedTime(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedTime === t ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"
                      }`}>
                      {to12Hour(t)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special requests or questions..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              <button
                disabled={!selectedDuration || !selectedDate}
                onClick={() => setStep("waiver")}
                className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
                Continue to Waiver →
              </button>
            </div>
          )}

          {/* ── Step 2: Waiver ── */}
          {step === "waiver" && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-1 text-sm">Rental Waiver & Agreement</h3>
                <p className="text-xs text-gray-500 mb-3">Please read and sign before completing your booking.</p>

                {listing.waiver_url ? (
                  <a href={listing.waiver_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-green-700 font-semibold hover:underline mb-4 block">
                    📄 View Waiver Document ({listing.waiver_filename ?? "waiver"})
                  </a>
                ) : (
                  <div className="text-xs text-gray-400 italic mb-3">No waiver document uploaded by vendor.</div>
                )}

                <div className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 max-h-40 overflow-y-auto">
                  <p className="font-semibold mb-1">Standard Rental Terms:</p>
                  <p>By signing below, I agree to use the rented item(s) responsibly and return them in the same condition. I acknowledge that I am responsible for any damage, loss, or theft during the rental period. I understand that failure to return items on time may result in additional fees. I release {vendor.business_name} from liability for any injury or damage arising from the use of rented equipment, except where prohibited by law.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Full Name (Electronic Signature)</label>
                <input type="text" value={waiverName} onChange={(e) => setWaiverName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                waiverChecked ? "bg-green-50 border-green-400" : "border-gray-200 hover:border-green-300"
              }`}>
                <input type="checkbox" checked={waiverChecked} onChange={(e) => setWaiverChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-green-600 shrink-0" />
                <span className="text-sm text-gray-700">
                  I, <strong>{waiverName || "___________"}</strong>, have read and agree to the rental terms and waiver above. I understand this is a legally binding electronic signature.
                </span>
              </label>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep("pick")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
                <button onClick={() => { if (!waiverChecked || !waiverName.trim()) { setError("Please sign the waiver."); return; } setError(""); setStep("confirm"); }}
                  disabled={!waiverChecked || !waiverName.trim()}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                  Review Booking →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === "confirm" && selectedDuration && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-gray-900 text-sm mb-3">Booking Summary</h3>
                {[
                  ["Listing", listing.title],
                  ["Duration", `${selectedDuration.label} (${selectedDuration.hours}h)`],
                  ["Date", new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })],
                  ["Start time", to12Hour(selectedTime)],
                  ["Waiver signed by", waiverName],
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
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-green-700 text-lg">${Number(selectedDuration.price).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">Payment is collected by {vendor.business_name} directly. This booking is pending until they confirm.</p>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => setStep("waiver")} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
                <button onClick={submitBooking} disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                  {submitting ? "Submitting..." : "Confirm Booking ✓"}
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
              <p className="text-xs text-gray-400 mb-6">Your waiver was signed and submitted as <strong>{waiverName}</strong>.</p>
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
