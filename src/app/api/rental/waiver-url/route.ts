import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

const BUCKET = "rental-waivers";

// Returns a short-lived signed URL for a booking's generated waiver PDF.
// Only the booking's customer or the listing's vendor may access it.
export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get("booking");
  if (!bookingId) return NextResponse.json({ error: "Missing booking id" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: booking } = await admin
    .from("rental_bookings")
    .select("id, customer_id, vendor_id, signed_waiver_pdf_url, vendor:vendors(user_id)")
    .eq("id", bookingId)
    .single();

  if (!booking || !booking.signed_waiver_pdf_url) {
    return NextResponse.json({ error: "No signed waiver found" }, { status: 404 });
  }

  const vendor = Array.isArray(booking.vendor) ? booking.vendor[0] : booking.vendor;
  const isCustomer = booking.customer_id === user.id;
  const isVendor = vendor?.user_id === user.id;
  if (!isCustomer && !isVendor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(booking.signed_waiver_pdf_url, 60 * 10); // 10 minutes

  if (error || !data) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
