"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Reusable QR code. Renders `value` (usually a referral/share link) as a PNG
// data URL so it can be scanned from someone else's phone — or long-pressed /
// right-clicked to save and share.
export default function QrCode({
  value,
  size = 180,
  className = "",
  alt = "QR code",
  downloadName,
}: {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
  /** When set, renders a Download link so the QR can be saved and printed. */
  downloadName?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      // 2x for retina; go big when it's downloadable so the saved file is
      // print-quality (window decals, table tents).
      width: downloadName ? 1024 : size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827ff", light: "#ffffffff" },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value, size, downloadName]);

  // Reserve the space while encoding so the layout doesn't jump.
  if (!src) {
    return (
      <div
        className={`bg-gray-100 rounded-xl animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-xl bg-white ${className}`}
    />
  );

  if (!downloadName) return img;

  return (
    <span className="inline-flex flex-col items-center gap-1.5">
      {img}
      <a
        href={src}
        download={`${downloadName}.png`}
        className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline"
      >
        ⬇ Download
      </a>
    </span>
  );
}
