import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Home-screen icon for iOS. Apple renders transparency as black and applies its
// own rounded mask, so this is a SOLID green tile with the white home-pin on it
// (rather than the transparent pin used for the browser favicon).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52">
  <path d="M20 2C10.6 2 3.2 9.4 3.2 18.8c0 6.6 4.6 14.3 9.4 20.4a62 62 0 0 0 6 6.6 1.9 1.9 0 0 0 2.8 0 62 62 0 0 0 6-6.6c4.8-6.1 9.4-13.8 9.4-20.4C36.8 9.4 29.4 2 20 2z" fill="#ffffff"/>
  <path d="M20 10.6 28 18.4H25.4V27H14.6V18.4H12z" fill="#00a63e"/>
  <rect x="18" y="22" width="4" height="5" fill="#ffffff"/>
</svg>`;

export default function AppleIcon() {
  const pinDataUri = `data:image/svg+xml;base64,${Buffer.from(PIN).toString("base64")}`;

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
        <img src={pinDataUri} width={104} height={135} alt="" />
      </div>
    ),
    { ...size }
  );
}
