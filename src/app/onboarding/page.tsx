"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

// Unified post-signup intent hub. Everyone signs up the same, then chooses what
// they want to do here — none of these is permanent; all stay available later.
const CHOICES = [
  {
    href: "/onboarding/buyer",
    emoji: "🔎",
    title: "Explore local",
    blurb: "Discover local businesses, products, and deals near you — and earn Local Bucks.",
  },
  {
    href: "/sell",
    emoji: "🏷️",
    title: "Sell an item",
    blurb: "List something for sale as a private seller. No business account needed — takes a minute.",
  },
  {
    href: "/onboarding/vendor",
    emoji: "🏪",
    title: "Launch a storefront",
    blurb: "Set up a business page: services, jobs, estimates, analytics, and more — free during launch.",
  },
];

export default function OnboardingIntentPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-sm text-gray-500">Welcome!</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-amber-400 text-white rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <span className="text-2xl">🪙</span>
          <div>
            <p className="font-bold text-sm">You earned 10 Local Bucks!</p>
            <p className="text-xs opacity-90">Welcome bonus — just for signing up.</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">What would you like to do?</h1>
        <p className="text-gray-500 text-sm mb-6">Pick one to get started — you can do any of these anytime.</p>

        <div className="space-y-3">
          {CHOICES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-start gap-4 bg-white rounded-2xl border-2 border-gray-100 p-5 hover:border-green-400 hover:bg-green-50/40 transition-all"
            >
              <span className="text-3xl shrink-0">{c.emoji}</span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{c.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{c.blurb}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Just here to look around?{" "}
          <Link href="/search" className="text-green-600 font-medium hover:underline">Skip to browsing →</Link>
        </p>
      </div>
    </div>
  );
}
