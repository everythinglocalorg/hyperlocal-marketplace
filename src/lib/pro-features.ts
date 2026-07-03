// Single source of truth for what Local Pro includes.
// Rendered on the pricing page, the upgrade page, and the incubator page so the
// feature list never drifts between them. `title` doubles as the short checklist
// label; `desc` is the detailed explanation for card layouts.

export type ProFeature = { icon: string; title: string; desc: string };

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: "📋",
    title: "Create & send estimates",
    desc: "Build professional, itemized estimates and send them to customers in a couple of taps — then track what's pending, accepted, and won.",
  },
  {
    icon: "📅",
    title: "Appointment & booking manager",
    desc: "Take bookings and set appointments right from your dashboard. Confirm, reschedule, and keep your calendar full without the phone tag.",
  },
  {
    icon: "📊",
    title: "Business analytics",
    desc: "See views, clicks, and click-through rates for every listing in real time, so you always know what's working and what to fix.",
  },
  {
    icon: "🏬",
    title: "Storefront performance",
    desc: "Track store visits, your top listings, and how customers are finding you — turn raw traffic into decisions that grow sales.",
  },
  {
    icon: "💬",
    title: "Internal messaging",
    desc: "Chat directly with customers inside Everything Local. Every conversation lands in one inbox — no personal phone number required.",
  },
  {
    icon: "🔔",
    title: "Instant notifications",
    desc: "Get alerted the moment someone wants to buy, book, or request an estimate, so a hot lead never goes cold.",
  },
  {
    icon: "👥",
    title: "Customer CRM",
    desc: "An auto-built customer list from your bookings and orders. Know your regulars, spot your best customers, and follow up.",
  },
  {
    icon: "💳",
    title: "Get paid with Stripe",
    desc: "Connect Stripe and accept card payments directly from customers — no middleman, no commission, money straight to your account.",
  },
  {
    icon: "🌐",
    title: "Custom domain",
    desc: "Connect your own domain (yourbusiness.com) to your storefront for a branded, professional presence customers trust.",
  },
  {
    icon: "🪙",
    title: "Earn Local Bucks on referrals",
    desc: "Refer neighbors and businesses and earn Local Bucks — turn word-of-mouth into rewards you can spend around town.",
  },
  {
    icon: "🚀",
    title: "Priority & featured placement",
    desc: "Rank above free listings in local search and get featured in category browsing, so more nearby customers see you first.",
  },
  {
    icon: "⭐",
    title: "Local Pro badge",
    desc: "An established-local-pro badge on your storefront and in search results that signals trust to buyers at a glance.",
  },
  {
    icon: "📦",
    title: "Unlimited listings",
    desc: "Add as many products, services, rentals, and menu items as you want — the free plan is capped at 10.",
  },
];
