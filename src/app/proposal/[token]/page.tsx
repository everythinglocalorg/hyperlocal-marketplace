import { createClient as createAdmin } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import ProposalCustomerView from "@/components/proposal/ProposalCustomerView";
import { Area, Addon, DepositType, PaymentMethod } from "@/lib/estimate-pricing";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdmin();
  const { data } = await admin.from("estimates")
    .select("title, vendor:vendors(business_name)")
    .eq("share_token", token).maybeSingle();
  if (!data) return { title: "Proposal" };
  const vendor = Array.isArray(data.vendor) ? data.vendor[0] : data.vendor;
  return { title: `${data.title} — ${vendor?.business_name ?? "Proposal"}`, robots: { index: false } };
}

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdmin();

  const { data: est } = await admin
    .from("estimates")
    .select("*, vendor:vendors(id, business_name, slug, logo_url, phone, city, state, stripe_connect_enabled), media:estimate_media(id, area_id, kind, source, url, thumb_url, caption, position)")
    .eq("share_token", token)
    .maybeSingle();

  if (!est) notFound();

  const vendor = Array.isArray(est.vendor) ? est.vendor[0] : est.vendor;

  const data = {
    token,
    title: est.title as string,
    status: est.status as string,
    areas: (Array.isArray(est.areas) ? est.areas : []) as Area[],
    addons: (Array.isArray(est.addons) ? est.addons : []) as Addon[],
    depositType: (est.deposit_type as DepositType) ?? "percent",
    depositValue: Number(est.deposit_value) ?? 50,
    paymentMethods: (Array.isArray(est.payment_methods) ? est.payment_methods : ["card"]) as PaymentMethod[],
    projectOverview: (est.project_overview as string) ?? null,
    notes: (est.notes as string) ?? null,
    proposalNumber: (est.proposal_number as string) ?? null,
    salesperson: (est.salesperson as string) ?? null,
    createdAt: est.created_at as string,
    expiresAt: (est.expires_at as string) ?? null,
    acceptedAt: (est.accepted_at as string) ?? null,
    depositPaidAt: (est.deposit_paid_at as string) ?? null,
    customer: {
      name: (est.customer_name as string) ?? null,
      email: (est.customer_email as string) ?? null,
      phone: (est.customer_phone as string) ?? null,
      address: (est.customer_address as string) ?? null,
    },
    savedSelections: (est.customer_selections as { line_ids?: string[]; addon_ids?: string[] }) ?? null,
    media: (Array.isArray(est.media) ? est.media : []) as {
      id: string; area_id: string | null; kind: string; source: string; url: string; thumb_url: string | null; caption: string | null; position: number;
    }[],
    vendor: {
      businessName: (vendor?.business_name as string) ?? "Business",
      slug: (vendor?.slug as string) ?? null,
      logoUrl: (vendor?.logo_url as string) ?? null,
      phone: (vendor?.phone as string) ?? null,
      city: (vendor?.city as string) ?? null,
      state: (vendor?.state as string) ?? null,
      connectEnabled: Boolean(vendor?.stripe_connect_enabled),
    },
  };

  return <ProposalCustomerView data={data} />;
}
