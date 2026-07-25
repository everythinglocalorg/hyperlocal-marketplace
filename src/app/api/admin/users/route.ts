import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client bypasses RLS and unlocks the Auth Admin API (ban/delete
// users). Never expose this key to the browser — these actions run server-side
// only, gated by requireAdmin().
function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "Forbidden" as const, status: 403 };
  return { adminId: user.id };
}

// ~100 years — GoTrue treats a banned user as unable to sign in or refresh a
// session. "none" clears the ban.
const BAN_FOREVER = "876000h";

// Block / unblock a user. Blocking bans them in Supabase Auth (they can no
// longer log in or refresh their session) AND flags the profile for display.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  const block = body.block === true;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  if (!userId)
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  if (userId === auth.adminId)
    return NextResponse.json({ error: "You can't block your own account." }, { status: 400 });

  const db = service();

  const { error: banError } = await db.auth.admin.updateUserById(userId, {
    ban_duration: block ? BAN_FOREVER : "none",
  });
  if (banError)
    return NextResponse.json({ error: banError.message }, { status: 500 });

  await db
    .from("profiles")
    .update({
      blocked: block,
      blocked_at: block ? new Date().toISOString() : null,
      blocked_reason: block ? reason : null,
    })
    .eq("id", userId);

  await db.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: block ? "block_user" : "unblock_user",
    target_type: "user",
    target_id: userId,
    detail: reason,
  });

  return NextResponse.json({ ok: true, blocked: block });
}

// Permanently delete a user. Removes the auth.users record, which cascades to
// the profiles row (FK on delete cascade). Fails cleanly if the account still
// owns records protected by a restrictive foreign key.
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId)
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  if (userId === auth.adminId)
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });

  const db = service();

  // Capture the email for the log before the row is gone.
  const { data: target } = await db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json(
      {
        error:
          "Couldn't delete this user — they may still own a business or listings. Remove those first, or block the account instead.",
        detail: error.message,
      },
      { status: 409 }
    );
  }

  await db.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "delete_user",
    target_type: "user",
    target_id: userId,
    detail: target?.email ?? null,
  });

  return NextResponse.json({ ok: true });
}
