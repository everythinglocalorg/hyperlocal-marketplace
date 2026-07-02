import Link from "next/link";
import { LocalProPriceInline } from "@/components/LocalProPrice";
import { LOCAL_PRO_ORIGINAL_PRICE, LOCAL_PRO_PRICE } from "@/lib/pricing";

interface PremiumGateProps {
  feature: string;
}

export default function PremiumGate({ feature }: PremiumGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Local Pro Feature</h2>
      <p className="text-gray-500 mb-2 max-w-sm">
        <span className="font-medium text-gray-700">{feature}</span> is available on the Local Pro plan.
      </p>
      <p className="text-gray-400 text-sm mb-8 max-w-sm">
        Upgrade to unlock analytics, CRM tools, smart buttons, and everything you need to grow your business — all for{" "}
        <LocalProPriceInline />.
      </p>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 w-full max-w-sm shadow-sm text-left">
        <p className="font-bold text-gray-900 mb-3">Local Pro includes:</p>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            "📊 Analytics dashboard (views, clicks, conversions)",
            "📦 Full inventory & listing manager",
            "👥 CRM — customer database & history",
            "📅 Booking management & calendar",
            "📞 Click-to-Call & Click-to-Book buttons",
            "⚡ Auto-responders & follow-up workflows",
            "⭐ Priority search placement",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="shrink-0">{item.slice(0, 2)}</span>
              <span>{item.slice(3)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/dashboard/vendor/upgrade"
        className="bg-green-600 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-green-700 transition-colors text-sm"
      >
        Upgrade to Local Pro — <span className="line-through opacity-60">${LOCAL_PRO_ORIGINAL_PRICE}</span> ${LOCAL_PRO_PRICE}/month
      </Link>
      <p className="text-xs text-gray-400 mt-3">Cancel anytime. No contracts.</p>
    </div>
  );
}
