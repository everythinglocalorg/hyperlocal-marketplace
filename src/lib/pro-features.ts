// Single source of truth for what the paid plans include.
// `plan` decides which column a feature shows in on the pricing page:
//   'pro'  → Local Pro ($49)     'plus' → Local Pro+ (top tier)
// Local Pro+ always includes everything in Local Pro.

export type PlanTier = "pro" | "plus";
export type ProFeature = { icon: string; title: string; desc: string; plan: PlanTier };

export const PRO_FEATURES: ProFeature[] = [
  {
    icon: "📅",
    title: "Appointment & booking manager",
    desc: "Take bookings and set appointments right from your dashboard. Confirm, reschedule, and keep your calendar full without the phone tag.",
    plan: "pro",
  },
  {
    icon: "📊",
    title: "Business analytics",
    desc: "See views, clicks, and click-through rates for every listing in real time, so you always know what's working and what to fix.",
    plan: "pro",
  },
  {
    icon: "🏬",
    title: "Storefront performance",
    desc: "Track store visits, your top listings, and how customers are finding you — turn raw traffic into decisions that grow sales.",
    plan: "pro",
  },
  {
    icon: "💬",
    title: "Internal messaging",
    desc: "Chat directly with customers inside Everything Local. Every conversation lands in one inbox — no personal phone number required.",
    plan: "pro",
  },
  {
    icon: "🔔",
    title: "Instant notifications",
    desc: "Get alerted the moment someone wants to buy, book, or request an estimate, so a hot lead never goes cold.",
    plan: "pro",
  },
  {
    icon: "👥",
    title: "Customer CRM",
    desc: "An auto-built customer list from your bookings and orders. Know your regulars, spot your best customers, and follow up.",
    plan: "pro",
  },
  {
    icon: "📋",
    title: "Create & send estimates",
    desc: "Build professional, itemized estimates and send them to customers in a couple of taps — then track what's pending, accepted, and won.",
    plan: "plus",
  },
  {
    icon: "⚡",
    title: "Auto-text new leads",
    desc: "The moment a lead comes in, an automatic text goes out so you respond in seconds — even when you're on the job. (Coming soon)",
    plan: "plus",
  },
  {
    icon: "💳",
    title: "Get paid with Stripe",
    desc: "Connect Stripe and accept card payments directly from customers — no middleman, no commission, money straight to your account.",
    plan: "plus",
  },
  {
    icon: "🌐",
    title: "Custom domain",
    desc: "Connect your own domain (yourbusiness.com) to your storefront for a branded, professional presence customers trust.",
    plan: "plus",
  },
  {
    icon: "🪙",
    title: "Earn Local Bucks on referrals",
    desc: "Refer neighbors and businesses and earn Local Bucks — turn word-of-mouth into rewards you can spend around town.",
    plan: "plus",
  },
  {
    icon: "🚀",
    title: "Priority & featured placement",
    desc: "Rank above free listings in local search and get featured in category browsing, so more nearby customers see you first.",
    plan: "plus",
  },
  {
    icon: "⭐",
    title: "Local Verified badge",
    desc: "An established-local-pro badge on your storefront and in search results that signals trust to buyers at a glance.",
    plan: "plus",
  },
  {
    icon: "🏅",
    title: "Founding Member badge",
    desc: "A badge marking you as one of the first businesses to build on Everything Local — earned only during launch.",
    plan: "plus",
  },
  {
    icon: "📦",
    title: "Unlimited listings",
    desc: "Add as many products, services, rentals, and menu items as you want — the free plan is capped at 10.",
    plan: "plus",
  },
  {
    icon: "🎧",
    title: "Priority support",
    desc: "Jump the line — your questions get answered first so you're never stuck.",
    plan: "plus",
  },
];

export const LOCAL_PRO_FEATURES = PRO_FEATURES.filter((f) => f.plan === "pro");
export const LOCAL_PRO_PLUS_FEATURES = PRO_FEATURES.filter((f) => f.plan === "plus");
