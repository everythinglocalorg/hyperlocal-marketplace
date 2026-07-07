import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddPlaceClient from "./AddPlaceClient";

export default async function AddPlacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/places/add");

  return <AddPlaceClient userId={user.id} />;
}
