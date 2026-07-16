import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// PWA manifest icons (192 / 512). Solid green tile + white home-pin.
// The pin is kept inside the maskable "safe zone" (centre ~60%) so Android's
// circular/squircle mask never crops it — the same asset works for both the
// `any` and `maskable` purposes.
const PIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52">
  <path d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z" fill="#ffffff"/>
  <path d="M20 10.6 28 18.4H25.4V27H14.6V18.4H12z" fill="#00a63e"/>
  <rect x="18" y="22" width="4" height="5" fill="#ffffff"/>
</svg>`;

const ALLOWED = new Set([192, 512]);

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!ALLOWED.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  const pinDataUri = `data:image/svg+xml;base64,${Buffer.from(PIN).toString("base64")}`;
  // Pin height ≈ 55% of the tile keeps it well inside the maskable safe zone.
  const pinH = Math.round(size * 0.55);
  const pinW = Math.round(pinH * (40 / 52));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#00a63e",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pinDataUri} width={pinW} height={pinH} alt="" />
      </div>
    ),
    { width: size, height: size }
  );
}
