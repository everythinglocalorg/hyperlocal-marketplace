import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

type Section = { heading: string; intro?: string; bullets?: string[] };
type Guide = {
  title: string;
  subtitle: string;
  minutes: number;
  sections: Section[];
  cta: { label: string; href: string };
};

const GUIDES: Record<string, Guide> = {
  "idea-and-validation": {
    title: "Idea & validation guide",
    subtitle: "Test demand in your town before you spend a dollar.",
    minutes: 6,
    sections: [
      {
        heading: "1. Start with a real local problem",
        intro: "The best local businesses solve a problem neighbors already have. Before anything else, get specific:",
        bullets: [
          "Who exactly is your customer, and what are they frustrated with today?",
          "What do they currently do instead — and why is it annoying, slow, or expensive?",
          "Could you serve them within your city and radius? Local beats broad.",
        ],
      },
      {
        heading: "2. Check existing demand on Everything Local",
        intro: "Use the marketplace itself as free market research:",
        bullets: [
          "Search your category on the Search page and see how many businesses already serve it locally.",
          "Read Local Pages — people literally post what they're looking for and can't find.",
          "Few or no results in your category is a gap, not a dead end — that's white space you can own.",
        ],
      },
      {
        heading: "3. Validate before you build",
        bullets: [
          "Talk to 10 potential local customers. Would they pay? How much? How often?",
          "Pre-sell if you can — a deposit or a waitlist is the strongest signal there is.",
          "Post a free listing and measure real interest (views, inquiries) before investing.",
        ],
      },
      {
        heading: "4. Green light checklist",
        bullets: [
          "A clear customer and problem you can describe in one sentence.",
          "At least a handful of locals who said 'yes, I'd buy this.'",
          "A price that covers your costs and leaves profit.",
        ],
      },
    ],
    cta: { label: "Create a free listing to test demand →", href: "/signup?role=vendor" },
  },
  "getting-started": {
    title: "Getting-started checklist",
    subtitle: "The practical steps to register, price, and prepare to open.",
    minutes: 5,
    sections: [
      {
        heading: "1. The essentials",
        bullets: [
          "Pick a name — check it's not already taken locally, and grab a matching email.",
          "Decide your structure (sole proprietor, LLC, etc.) — check your state's small-business site.",
          "Look into any local permits or licenses your trade requires in Wisconsin or Minnesota.",
          "Open a separate account so business and personal money never mix.",
        ],
      },
      {
        heading: "2. Price it right",
        bullets: [
          "Add up your true costs per sale (materials, time, fees) — then add profit on top.",
          "Check what local competitors charge on their Everything Local storefronts.",
          "Don't compete on being cheapest. Compete on trust, quality, and being local.",
        ],
      },
      {
        heading: "3. Set up your storefront",
        intro: "Everything Local is your website, booking system, and CRM in one — no separate site needed.",
        bullets: [
          "Create your free vendor account and claim your business page.",
          "Add your logo, a clear description, and your service area (up to 10 towns).",
          "List your products or services with photos and honest pricing.",
        ],
      },
      {
        heading: "4. Before you open",
        bullets: [
          "Turn on the contact/estimate button so leads reach you instantly.",
          "Ask 2–3 early customers for a review to build trust from day one.",
          "Share your storefront link and referral link with your network.",
        ],
      },
    ],
    cta: { label: "Set up your free storefront →", href: "/signup?role=vendor" },
  },
  "storefront": {
    title: "Storefront best practices",
    subtitle: "Turn browsers into paying local customers.",
    minutes: 5,
    sections: [
      {
        heading: "1. Your logo & banner",
        bullets: [
          "Use a clean logo on a white background — it shows crisp on your card and in link previews.",
          "Blurry or dark photos cost you clicks. When in doubt, simpler is better.",
        ],
      },
      {
        heading: "2. Write a description that sells",
        bullets: [
          "Lead with what you do and who you serve: 'Family-owned roofing serving Eau Claire since 2019.'",
          "Name your town(s) — it helps you show up in local search and builds trust.",
          "Skip the jargon. Write like you'd talk to a neighbor.",
        ],
      },
      {
        heading: "3. Listings that convert",
        bullets: [
          "Every listing needs a real photo — listings with images get far more clicks.",
          "Be specific in titles: '4x12 sidewalk with mulch' beats 'concrete work.'",
          "Show a price or a clear 'Free estimate' — uncertainty kills conversions.",
          "Pick the right call-to-action per listing: Book, Call, Buy, Free estimate, or View menu.",
        ],
      },
      {
        heading: "4. Build trust fast",
        bullets: [
          "Collect reviews — ask happy customers right after the job.",
          "Keep your hours, phone, and service area current.",
          "Respond to inquiries quickly. Speed is the local advantage.",
        ],
      },
    ],
    cta: { label: "Edit your storefront →", href: "/dashboard/vendor" },
  },
  "first-customers": {
    title: "Winning your first customers",
    subtitle: "Land your first sales fast — the local way.",
    minutes: 5,
    sections: [
      {
        heading: "1. Work your existing network first",
        bullets: [
          "Your first customers are people who already know you. Share your storefront link directly.",
          "Use your referral link — neighbors who sign up and buy help you both earn Local Bucks.",
        ],
      },
      {
        heading: "2. Show up where locals are asking",
        bullets: [
          "Watch Local Pages for people requesting exactly what you offer, and reply.",
          "Post a helpful answer, not a hard sell — trust drives local sales.",
          "If you're hiring as you grow, post to the Jobs Board to reach nearby talent.",
        ],
      },
      {
        heading: "3. Make saying yes easy",
        bullets: [
          "Offer a clear first-time offer or free estimate to lower the risk.",
          "Reply to every inquiry fast — most locals buy from whoever answers first.",
          "Confirm details in writing (an estimate) so expectations are clear.",
        ],
      },
      {
        heading: "4. Turn one sale into three",
        bullets: [
          "Ask for a review the moment a customer is happy.",
          "Reward referrals with Local Bucks — word of mouth is your cheapest growth.",
          "Follow up. A quick 'thanks, here if you need us' brings repeat business.",
        ],
      },
    ],
    cta: { label: "Open Local Pages →", href: "/community/eau-claire-wi" },
  },
  "local-bucks": {
    title: "Local Bucks playbook",
    subtitle: "Turn rewards into repeat business and word of mouth.",
    minutes: 4,
    sections: [
      {
        heading: "1. What Local Bucks are",
        intro: "Local Bucks are the rewards shoppers earn for supporting local — and a growth engine for your business.",
        bullets: [
          "Customers earn them for signing up, reviewing, and referring.",
          "It gives neighbors a reason to choose local — and to come back.",
        ],
      },
      {
        heading: "2. Use them to drive reviews",
        bullets: [
          "Reviews build the trust that wins local customers — and shoppers earn Local Bucks for leaving them.",
          "Ask every happy customer: it helps them and it helps your ranking.",
        ],
      },
      {
        heading: "3. Fuel referrals",
        bullets: [
          "Share your referral link everywhere — invoices, receipts, social posts.",
          "Referred neighbors and referrers both benefit, so people actually share.",
        ],
      },
      {
        heading: "4. Keep customers coming back",
        bullets: [
          "A rewards habit means your customers keep shopping local — with you.",
          "Pair it with great service and fast replies, and repeat business compounds.",
        ],
      },
    ],
    cta: { label: "Learn more about Local Bucks →", href: "/local-bucks" },
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDES[slug];
  if (!g) return { title: "Guide — Everything Local Incubator" };
  return {
    title: `${g.title} — Everything Local Incubator`,
    description: g.subtitle,
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDES[slug];
  if (!guide) notFound();

  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="print:hidden mb-6">
          <Link href="/incubator" className="text-sm text-green-600 hover:underline">← Back to the Incubator</Link>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">Business Incubator · {guide.minutes} min read</p>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-2">{guide.title}</h1>
        <p className="text-lg text-gray-500 mb-6">{guide.subtitle}</p>

        <div className="flex items-center gap-3 mb-10 pb-8 border-b border-gray-100">
          <PrintButton />
          <span className="text-xs text-gray-400 print:hidden">Opens your print dialog — choose “Save as PDF.”</span>
        </div>

        {/* Body */}
        <div className="space-y-8">
          {guide.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{s.heading}</h2>
              {s.intro && <p className="text-gray-600 leading-relaxed mb-3">{s.intro}</p>}
              {s.bullets && (
                <ul className="space-y-2">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-gray-600 leading-relaxed">
                      <span className="text-green-600 mt-1 shrink-0">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
          <Link href={guide.cta.href} className="inline-block bg-green-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-green-700 transition-colors">
            {guide.cta.label}
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">Everything Local Incubator · You run the business, we power it.</p>
      </article>
    </div>
  );
}
