import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessagesTabs from "@/components/messaging/MessagesTabs";

export const metadata: Metadata = { title: "Messages — Everything Local" };

// One inbox for everything — conversations (customer + business sides) and
// notifications/offers, split into two tabs.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { c, tab } = await searchParams;
  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("notifications").select("id, type, title, body, link, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <MessagesTabs
      me={{ id: user.id, full_name: profile?.full_name ?? null, avatar_url: profile?.avatar_url ?? null }}
      initialNotifs={notifications ?? []}
      initialConvoId={c ?? null}
      initialTab={tab === "notifications" ? "notifications" : "messages"}
    />
  );
}
