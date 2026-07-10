import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Branded link-preview image shown when Everything Local links are shared.
export function GET() {
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
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 128,
            fontWeight: 800,
            color: "#16a34a",
            letterSpacing: "-3px",
            lineHeight: 1,
          }}
        >
          Everything Local
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
          Browse Local Like Never Before
        </div>
        <div style={{ display: "flex", marginTop: 44, width: 120, height: 6, backgroundColor: "#16a34a", borderRadius: 6 }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
