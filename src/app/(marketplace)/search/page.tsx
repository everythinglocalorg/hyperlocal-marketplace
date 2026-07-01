import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import SearchClient from "./SearchClient";

export default async function SearchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initialCity: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_city")
      .eq("id", user.id)
      .single();
    initialCity = profile?.default_city ?? undefined;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 animate-pulse" />}>
      <SearchClient initialCity={initialCity} />
    </Suspense>
  );
}
