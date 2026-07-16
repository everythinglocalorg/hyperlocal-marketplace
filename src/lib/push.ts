import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Server-side Web Push sending. Reads a user's device subscriptions with the
// service role (bypasses RLS) and fans a notification out to all of them.
//
// Fire-and-forget by design: a push failure must never break the action that
// triggered it (sending a message, applying to a job, etc.).

type PushPayload = {
  title: string;
  body?: string;
  url?: string;   // where the notification click should land
  tag?: string;   // same tag replaces an earlier notification
};

let configured = false;
function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@everythinglocal.org",
      publicKey,
      privateKey
    );
    configured = true;
  }
  return true;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configure()) return;              // keys not set → silently skip
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

    const db = admin();
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) return;

    const body = JSON.stringify(payload);
    const dead: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err) {
          // 404/410 = the browser dropped this subscription; stop pushing to it.
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) dead.push(s.endpoint);
        }
      })
    );

    if (dead.length) {
      await db.from("push_subscriptions").delete().in("endpoint", dead);
    }
  } catch {
    // never surface push problems to the caller
  }
}
