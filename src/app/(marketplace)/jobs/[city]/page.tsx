import { createClient } from "@/lib/supabase/server";
import { resolveCity } from "@/lib/cities";
import JobsBoardClient from "./JobsBoardClient";

export default async function JobsBoardPage({ params }: { params: Promise<{ city: string }> }) {
  const supabase = await createClient();
  const { city: citySlug } = await params;

  const parts = citySlug.split("-");
  const stateCode = parts[parts.length - 1].toUpperCase();
  const cityName = parts.slice(0, -1).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = user
      ? await supabase.from("profiles").select("id, full_name, avatar_url, role").eq("id", user.id).single()
      : { data: null };

    // The poster's business, if they have one (jobs can be posted as a business)
    const { data: myVendor } = user
      ? await supabase.from("vendors").select("id, business_name, slug, logo_url").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle()
      : { data: null };

    // Town center — seed cities resolve instantly, others come from the cached cities table
    const seed = resolveCity(citySlug);
    let center: { latitude: number; longitude: number } | null =
      seed?.latitude != null && seed?.longitude != null
        ? { latitude: seed.latitude, longitude: seed.longitude }
        : null;
    if (!center) {
      const { data: cityRow } = await supabase
        .from("cities").select("latitude, longitude").eq("slug", citySlug).maybeSingle();
      if (cityRow?.latitude != null && cityRow?.longitude != null) {
        center = { latitude: cityRow.latitude, longitude: cityRow.longitude };
      }
    }

    // Local jobs + jobs from nearby towns whose radius reaches this town
    let jobs: any[] = [];
    if (center) {
      const { data, error } = await supabase.rpc("jobs_nearby", {
        p_latitude: center.latitude,
        p_longitude: center.longitude,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      jobs = data ?? [];
    } else {
      // No known center — fall back to jobs posted directly in this town
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("city_slug", citySlug)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      jobs = (data ?? []).map((j: any) => ({ ...j, distance_miles: 0 }));
    }

    // Enrich with poster and business info
    const userIds = [...new Set(jobs.map((j) => j.user_id).filter(Boolean))];
    const vendorIds = [...new Set(jobs.map((j) => j.vendor_id).filter(Boolean))];

    const authorsById: Record<string, any> = {};
    if (userIds.length) {
      const { data: authors } = await supabase
        .from("profiles").select("id, full_name, avatar_url").in("id", userIds);
      authors?.forEach((a: any) => { authorsById[a.id] = a; });
    }
    const vendorsById: Record<string, any> = {};
    if (vendorIds.length) {
      const { data: jobVendors } = await supabase
        .from("vendors").select("id, business_name, slug, logo_url").in("id", vendorIds);
      jobVendors?.forEach((v: any) => { vendorsById[v.id] = v; });
    }

    const enrichedJobs = jobs.map((j) => ({
      ...j,
      author: authorsById[j.user_id] ?? null,
      vendor: j.vendor_id ? vendorsById[j.vendor_id] ?? null : null,
    }));

    return (
      <JobsBoardClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        center={center}
        jobs={enrichedJobs}
        currentUser={profile ?? null}
        myVendor={myVendor ?? null}
      />
    );
  } catch (err) {
    console.error("Jobs board page error:", err);
    return (
      <JobsBoardClient
        citySlug={citySlug}
        cityName={cityName}
        stateCode={stateCode}
        center={null}
        jobs={[]}
        currentUser={null}
        myVendor={null}
      />
    );
  }
}
