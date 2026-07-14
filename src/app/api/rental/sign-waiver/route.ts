import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BUCKET = "rental-waivers";

// Wrap a paragraph to a max width for a given font/size.
function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const {
      bookingId,
      signatureDataUrl,
      signerName,
      listingTitle,
      waiverBody,
      waiverUrl,
    } = await req.json();

    if (!bookingId || !signatureDataUrl || !signerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = admin();
    const signedAt = new Date();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // Decode the signature PNG.
    const sigBase64 = String(signatureDataUrl).replace(/^data:image\/png;base64,/, "");
    const sigBytes = Buffer.from(sigBase64, "base64");

    // ── Build the flattened signed PDF ────────────────────────
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // 1) Include the vendor's uploaded waiver first, if any.
    if (waiverUrl) {
      try {
        const res = await fetch(waiverUrl);
        const buf = new Uint8Array(await res.arrayBuffer());
        const type = res.headers.get("content-type") ?? "";
        if (type.includes("pdf") || String(waiverUrl).toLowerCase().endsWith(".pdf")) {
          const src = await PDFDocument.load(buf);
          const pages = await pdf.copyPages(src, src.getPageIndices());
          pages.forEach((p) => pdf.addPage(p));
        } else {
          // Image waiver — place it on its own page.
          const img = type.includes("png") || String(waiverUrl).toLowerCase().endsWith(".png")
            ? await pdf.embedPng(buf)
            : await pdf.embedJpg(buf);
          const page = pdf.addPage([612, 792]);
          const scale = Math.min((612 - 72) / img.width, (792 - 72) / img.height, 1);
          page.drawImage(img, {
            x: 36,
            y: 792 - 36 - img.height * scale,
            width: img.width * scale,
            height: img.height * scale,
          });
        }
      } catch {
        // Ignore a broken/unfetchable vendor doc — the text + certificate still get signed.
      }
    }

    // 2) Waiver body text page (if the vendor pasted text).
    if (waiverBody && String(waiverBody).trim()) {
      let page = pdf.addPage([612, 792]);
      let y = 792 - 56;
      page.drawText("Rental Waiver & Agreement", { x: 48, y, size: 16, font: bold });
      y -= 28;
      for (const line of wrap(String(waiverBody), font, 11, 612 - 96)) {
        if (y < 56) {
          page = pdf.addPage([612, 792]);
          y = 792 - 56;
        }
        page.drawText(line, { x: 48, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
        y -= 16;
      }
    }

    // 3) Signature / certificate page.
    const cert = pdf.addPage([612, 792]);
    let cy = 792 - 64;
    cert.drawText("Signature & Acknowledgment", { x: 48, y: cy, size: 18, font: bold });
    cy -= 36;
    const rows: [string, string][] = [
      ["Listing", String(listingTitle ?? "—")],
      ["Booking ID", String(bookingId)],
      ["Signed by", String(signerName)],
      ["Signed at", signedAt.toLocaleString("en-US")],
      ["IP address", ip],
    ];
    for (const [k, v] of rows) {
      cert.drawText(`${k}:`, { x: 48, y: cy, size: 11, font: bold, color: rgb(0.35, 0.35, 0.35) });
      cert.drawText(v, { x: 160, y: cy, size: 11, font });
      cy -= 20;
    }

    cy -= 16;
    cert.drawText("Signature:", { x: 48, y: cy, size: 11, font: bold, color: rgb(0.35, 0.35, 0.35) });
    cy -= 12;
    try {
      const sigImg = await pdf.embedPng(sigBytes);
      const w = Math.min(320, sigImg.width);
      const h = (sigImg.height / sigImg.width) * w;
      cert.drawRectangle({ x: 46, y: cy - h - 8, width: w + 8, height: h + 8, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      cert.drawImage(sigImg, { x: 50, y: cy - h - 4, width: w, height: h });
      cy -= h + 24;
    } catch {
      cy -= 24;
    }

    cert.drawText(
      "This document was signed electronically and constitutes a legally binding signature.",
      { x: 48, y: 48, size: 8, font, color: rgb(0.5, 0.5, 0.5) }
    );

    const pdfBytes = await pdf.save();

    // ── Upload signature PNG + PDF to the private bucket ──────
    const base = `${bookingId}`;
    const sigPath = `${base}/signature.png`;
    const pdfPath = `${base}/signed-waiver.pdf`;

    const up1 = await supabase.storage.from(BUCKET).upload(sigPath, sigBytes, {
      contentType: "image/png",
      upsert: true,
    });
    const up2 = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (up1.error || up2.error) {
      return NextResponse.json(
        { error: "Storage upload failed. Ensure the 'rental-waivers' bucket exists (run supabase/rentals_enhancements.sql)." },
        { status: 500 }
      );
    }

    // ── Persist paths + audit metadata on the booking ─────────
    const { error: updErr } = await supabase
      .from("rental_bookings")
      .update({
        waiver_signature_url: sigPath,
        signed_waiver_pdf_url: pdfPath,
        waiver_ip: ip,
        waiver_user_agent: userAgent,
      })
      .eq("id", bookingId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pdfPath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate waiver.";
    console.error("sign-waiver error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
