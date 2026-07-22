import { ImageResponse } from "next/og";

export const runtime = "nodejs";
// The card varies by ?title/?subtitle — render per request, never cache a stale one.
export const dynamic = "force-dynamic";

// Link-preview (Open Graph) image shown when Everything Local links are shared.
// Look: full-bleed hero photo + a dark bottom-up gradient scrim + white
// Archivo-Black wordmark/title on top — matching the brand logo.
//
// The hero photo lives at /public/og-hero.jpg. If it's missing (or fails to
// load) the card falls back to a deep-green brand gradient so it still looks
// sharp. Pages pass ?title= and ?subtitle= to headline their own preview.

// Archivo Black (the logo typeface) for the overlay text. Fetched once and
// cached across invocations; if the fetch fails we fall back to a system bold.
let archivoPromise: Promise<ArrayBuffer | null> | null = null;
function loadArchivo(): Promise<ArrayBuffer | null> {
  if (!archivoPromise) {
    archivoPromise = fetch(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/ArchivoBlack-Regular.ttf"
    )
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return archivoPromise;
}

// Pull the hero photo bytes so a missing file degrades to the brand background
// instead of throwing the whole render.
async function loadHero(origin: string): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/og-hero.jpg`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const title = (searchParams.get("title") || "Everything Local").slice(0, 60);
  const subtitle = (searchParams.get("subtitle") || "Browse Local Like Never Before").slice(0, 80);
  // Size the headline so it stays on ONE line within the 1080px content width
  // (Archivo Black uppercase runs ~0.62em per char with the tight tracking).
  const titleSize = Math.max(40, Math.min(96, Math.floor(1080 / (title.length * 0.62))));

  const [archivo, hero] = await Promise.all([loadArchivo(), loadHero(origin)]);
  const fontFamily = archivo ? "Archivo Black" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          // Deep-green brand fallback shown when there's no photo.
          backgroundImage: "linear-gradient(135deg, #14532d 0%, #166534 55%, #15803d 100%)",
        }}
      >
        {/* Hero photo (full bleed) */}
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Heavy dark scrim so the white text pops over any photo. Explicit
            width/height (not inset:0), or Satori gives it zero area and it
            never darkens anything. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.82) 100%)",
          }}
        />

        {/* Centered lockup: green pin + white Archivo-Black wordmark/headline.
            Explicit width/height (not inset:0) so Satori can vertically center. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 60px",
          }}
        >
          <svg width="58" height="76" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 8 }}>
            <path
              d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z"
              fill="#22c55e"
            />
            <path d="M20 10.6 28 18.4H25.4V27H14.6V18.4H12z" fill="#ffffff" />
            <rect x="18" y="22" width="4" height="5" fill="#22c55e" />
          </svg>
          <div
            style={{
              display: "flex",
              fontFamily,
              fontSize: titleSize,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: "rgba(255,255,255,0.92)", letterSpacing: "0.5px", textAlign: "center" }}>
            {subtitle}
          </div>
          <div style={{ display: "flex", marginTop: 22, width: 100, height: 6, backgroundColor: "#22c55e", borderRadius: 6 }} />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: archivo ? [{ name: "Archivo Black", data: archivo, weight: 400, style: "normal" }] : undefined,
    }
  );
}
