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
}: {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,          // 2x so it stays crisp on retina
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827ff", light: "#ffffffff" },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value, size]);

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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-xl bg-white ${className}`}
    />
  );
}
