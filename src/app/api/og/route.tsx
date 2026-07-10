import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Branded link-preview image shown when Everything Local links are shared.
// Accepts optional ?title= and ?subtitle= so pages without their own photo
// (e.g. the Explore page, or a place with no image yet) still get a clean,
// on-brand preview card instead of a blank/placeholder.
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "Everything Local").slice(0, 60);
  const subtitle = (searchParams.get("subtitle") || "Browse Local Like Never Before").slice(0, 80);
  const titleSize = title.length > 26 ? 76 : title.length > 16 ? 100 : 128;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          padding: "0 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 800,
            color: "#16a34a",
            letterSpacing: "-3px",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 40,
            color: "#6b7280",
            letterSpacing: "1px",
          }}
        >
          {subtitle}
        </div>
        <div style={{ display: "flex", marginTop: 44, width: 120, height: 6, backgroundColor: "#16a34a", borderRadius: 6 }} />
        {title !== "Everything Local" && (
          <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#9ca3af", letterSpacing: "2px" }}>
            EVERYTHING LOCAL
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
