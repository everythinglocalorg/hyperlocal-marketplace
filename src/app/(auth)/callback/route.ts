import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? null;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

      // Does this user already own a business? A user can own SEVERAL — never
      // use .single() here (it errors on multiple rows, which made established
      // owners look like they had none and wrongly dumped them into onboarding).
      const { data: vendorRows } = await supabase
        .from("vendors")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1);
      const hasVendor = (vendorRows?.length ?? 0) > 0;

      // Only a brand-new signup (account created moments ago, no business yet,
      // not an admin) still goes through onboarding. Everyone else — returning
      // users, business owners — lands on the home page.
      const isNewSignup = Date.now() - new Date(data.user.created_at).getTime() < 2 * 60 * 1000;
      if (isNewSignup && !hasVendor && !profile?.is_admin) {
        return NextResponse.redirect(
          `${origin}${profile?.role === "vendor" ? "/onboarding/vendor" : "/onboarding/buyer"}`
        );
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
