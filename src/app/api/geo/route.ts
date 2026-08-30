import { NextResponse } from "next/server";

// Best-effort, silent location from the visitor's IP. Vercel injects these
// headers at the edge — no permission prompt, no external lookup. Returns nulls
// locally (headers absent) and in that case the caller just falls back to the
// manual location picker.
export const runtime = "edge";

export async function GET(request: Request) {
  const h = request.headers;
  const rawCity = h.get("x-vercel-ip-city");
  const lat = h.get("x-vercel-ip-latitude");
  const lng = h.get("x-vercel-ip-longitude");

  return NextResponse.json({
    city: rawCity ? decodeURIComponent(rawCity) : null,
    region: h.get("x-vercel-ip-country-region"), // 2-letter state code, e.g. "WI"
    country: h.get("x-vercel-ip-country"),
    latitude: lat ? parseFloat(lat) : null,
    longitude: lng ? parseFloat(lng) : null,
  });
}
