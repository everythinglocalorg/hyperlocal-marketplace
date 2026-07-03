"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 border-2 border-green-600 text-green-700 font-bold px-5 py-2.5 rounded-xl hover:bg-green-50 transition-colors text-sm"
    >
      🖨️ Save as PDF
    </button>
  );
}
