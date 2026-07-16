"use client";

import { useEffect, useState } from "react";
import QrCode from "@/components/QrCode";

// Shown once at the end of onboarding: the Local Bucks referral pitch with a
// scannable QR of the user's referral link, plus how to install the site as an
// app on their phone. Install steps are platform-aware because iOS and Android
// differ (and iOS *requires* Add to Home Screen for push to work at all).

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export default function WelcomeReferralModal({
  referralLink,
  onClose,
}: {
  referralLink: string;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [copied, setCopied] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
  }, []);

  function copy() {
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Everything Local",
          text: "Join me on Everything Local — shop local and earn Local Bucks.",
          url: referralLink,
        });
        return;
      } catch { /* user cancelled — fall through to copy */ }
    }
    copy();
  }

  const steps: Record<Platform, string[]> = {
    ios: [
      "Open everythinglocal.org in Safari",
      "Tap the Share button (□↑) at the bottom",
      "Choose “Add to Home Screen”, then tap Add",
    ],
    android: [
      "Open everythinglocal.org in Chrome",
      "Tap the ⋮ menu (top right)",
      "Choose “Install app” or “Add to Home screen”",
    ],
    desktop: [
      "On your phone, scan the QR code above",
      "iPhone: Share → Add to Home Screen · Android: ⋮ → Install app",
      "Open it from your home screen — it runs full-screen like an app",
    ],
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
        {/* Header */}
        <div className="bg-green-600 rounded-t-2xl px-6 py-6 text-center">
          <p className="text-4xl mb-2">🪙</p>
          <h2 className="text-white text-xl font-black leading-tight">
            Earn Local Bucks for referring friends &amp; businesses
          </h2>
          <p className="text-green-100 text-sm mt-1.5">
            Get <strong>20 Local Bucks</strong> every time someone joins with your link — and they get
            10 just for signing up.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Referral QR */}
          <div className="flex flex-col items-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
              Have them scan this
            </p>
            <div className="border border-gray-100 rounded-2xl p-3 shadow-sm">
              <QrCode value={referralLink} size={168} alt="Your referral QR code" />
            </div>
            <p className="text-[11px] text-gray-400 mt-2 text-center max-w-[16rem] break-all">
              {referralLink}
            </p>
            <div className="flex gap-2 mt-3 w-full">
              <button
                onClick={copy}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {copied ? "✓ Copied!" : "Copy link"}
              </button>
              <button
                onClick={share}
                className="flex-1 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
              >
                Share
              </button>
            </div>
          </div>

          {/* Install instructions */}
          {!installed && (
            <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
              <p className="text-sm font-bold text-gray-900 mb-0.5">📲 Put it on your phone</p>
              <p className="text-xs text-gray-500 mb-3">
                Add Everything Local to your home screen — it opens full-screen like an app and can send
                you notifications.
              </p>
              <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                {steps[platform].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            Start exploring →
          </button>
        </div>
      </div>
    </div>
  );
}
