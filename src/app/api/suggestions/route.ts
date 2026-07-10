import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Location-aware trending search terms. Reads the aggregated, privacy-guarded
// `trending_searches` RPC (SECURITY DEFINER, min-count threshold) so this can
// run with the anon key and be CDN-cached. Never errors out to the client —
// on any failure it returns an empty list and the UI falls back to seeds.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  try {
    const { data, error } = await supabase.rpc("trending_searches", {
      p_city: city,
      p_limit: 10,
    });
    if (error) throw error;

    const trending = (Array.isArray(data) ? data : []).map(
      (r: { term: string; searches: number }) => ({
        term: r.term,
        searches: Number(r.searches),
      })
    );

    return NextResponse.json(
      { city, trending },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
    );
  } catch {
    return NextResponse.json(
      { city, trending: [] },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
