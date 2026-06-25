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
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Check if vendor has a storefront yet
      if (profile?.role === "vendor") {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("user_id", data.user.id)
          .single();

        if (!vendor) {
          return NextResponse.redirect(`${origin}/onboarding/vendor`);
        }
        return NextResponse.redirect(`${origin}/dashboard/vendor`);
      }

      if (profile?.role === "admin") {
        return NextResponse.redirect(`${origin}/admin`);
      }

      // New buyer — check if they've onboarded (has a city preference saved via phone or visited before)
      // We use a simple heuristic: if created_at is within the last 2 minutes, they're new
      const createdAt = new Date(data.user.created_at);
      const isNewUser = Date.now() - createdAt.getTime() < 2 * 60 * 1000;
      if (isNewUser) {
        return NextResponse.redirect(`${origin}/onboarding/buyer`);
      }

      return NextResponse.redirect(`${origin}/dashboard/buyer`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
