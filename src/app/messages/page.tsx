import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UnifiedInbox from "@/components/messaging/UnifiedInbox";

export const metadata: Metadata = { title: "Messages — Everything Local" };

// One inbox for everything — the conversations where you're the customer and the
// ones where you're the business, merged.
export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <UnifiedInbox
      me={{ id: user.id, full_name: profile?.full_name ?? null, avatar_url: profile?.avatar_url ?? null }}
    />
  );
}
