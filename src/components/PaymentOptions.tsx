"use client";

// Peer-to-peer payment hand-off. Everything Local doesn't hold funds for private
// sales — buyers pay sellers directly. Sellers save their handles (Venmo, Cash
// App, Zelle, Apple Cash, cash) and we render live deep links here.
//
//   mode="pay"   → action buttons prefilled with the agreed amount + note
//   mode="info"  → compact chips just listing what the seller accepts

export type PaymentHandles = {
  venmo?: string | null;
  cashapp?: string | null;
  zelle?: string | null;
  accepts_apple_cash?: boolean | null;
  accepts_cash?: boolean | null;
};

function clean(h: string | null | undefined, strip: string) {
  return (h ?? "").trim().replace(/^[@$]/, "").replace(new RegExp(`^${strip}`), "").trim();
}

export default function PaymentOptions({
  handles, phone, amount, note, mode = "pay", className = "",
}: {
  handles: PaymentHandles | null | undefined;
  phone?: string | null;
  amount?: number | null;
  note?: string | null;
  mode?: "pay" | "info";
  className?: string;
}) {
  const h = handles ?? {};
  const venmo = clean(h.venmo, "");
  const cashapp = clean(h.cashapp, "");
  const zelle = (h.zelle ?? "").trim();
  const appleCash = !!h.accepts_apple_cash && !!phone;
  const cash = !!h.accepts_cash;
  const amt = amount != null && amount > 0 ? Number(amount).toFixed(2) : "";
  const noteEnc = encodeURIComponent(note ?? "Everything Local");

  const methods: { key: string; label: string; href?: string; hint?: string }[] = [];
  if (venmo) methods.push({ key: "venmo", label: "Pay with Venmo", href: `https://venmo.com/${venmo}?txn=pay${amt ? `&amount=${amt}` : ""}&note=${noteEnc}` });
  if (cashapp) methods.push({ key: "cashapp", label: "Pay with Cash App", href: `https://cash.app/$${cashapp}${amt ? `/${amt}` : ""}` });
  if (zelle) methods.push({ key: "zelle", label: `Zelle: ${zelle}`, hint: "Send in your bank app" });
  if (appleCash) methods.push({ key: "apple", label: "Apple Cash — text the seller", href: `sms:${phone}${amt ? `&body=${encodeURIComponent(`Sending $${amt} for ${note ?? "your item"} via Apple Cash`)}` : ""}` });
  if (cash) methods.push({ key: "cash", label: "Cash at pickup", hint: "Pay in person" });

  if (methods.length === 0) {
    return (
      <p className={`text-xs text-gray-400 ${className}`}>
        Message the seller to arrange payment (Venmo, Apple Cash, or cash at pickup).
      </p>
    );
  }

  // Info mode: compact chips naming the accepted methods (no amount).
  if (mode === "info") {
    const names = methods.map((m) => (m.key === "zelle" ? "Zelle" : m.key === "apple" ? "Apple Cash" : m.key === "cash" ? "Cash" : m.key === "cashapp" ? "Cash App" : "Venmo"));
    return (
      <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
        <span className="text-xs text-gray-400">Accepts</span>
        {names.map((n) => (
          <span key={n} className="text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">{n}</span>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {methods.map((m) =>
        m.href ? (
          <a
            key={m.key}
            href={m.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 w-full bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-green-700 transition-colors first:bg-green-600 [&:not(:first-child)]:bg-gray-900 [&:not(:first-child)]:hover:bg-gray-800"
          >
            <span>{m.label}{amt && m.key !== "apple" ? ` · $${amt}` : ""}</span>
            <span aria-hidden>→</span>
          </a>
        ) : (
          <div key={m.key} className="flex items-center justify-between gap-2 w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-full">
            <span>{m.label}</span>
            {m.hint && <span className="text-xs text-gray-400">{m.hint}</span>}
          </div>
        )
      )}
    </div>
  );
}
