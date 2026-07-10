"use client";
import { useState } from "react";
import PriceBookSettings from "@/components/vendor/PriceBookSettings";
import TemplateManager from "@/components/vendor/TemplateManager";
import SnippetManager from "@/components/vendor/SnippetManager";
import VideoLibrary from "@/components/vendor/VideoLibrary";

type Section = "templates" | "snippets" | "videos" | "pricebook";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "templates", label: "Templates", icon: "🧱" },
  { id: "snippets", label: "Text & Notes", icon: "✍️" },
  { id: "videos", label: "Video Library", icon: "🎬" },
  { id: "pricebook", label: "Price Book", icon: "🎨" },
];

// Hub for everything a vendor sets up once and reuses across proposals.
export default function EstimatorTools({ vendorId }: { vendorId: string }) {
  const [section, setSection] = useState<Section>("templates");

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Estimator Tools</h2>
        <p className="text-sm text-gray-500 mt-0.5">Reusable content your proposals pull from — set it up once, use it everywhere.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-100 pb-3">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors ${section === s.id ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            <span className="mr-1">{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {section === "templates" && <TemplateManager vendorId={vendorId} />}
      {section === "snippets" && <SnippetManager vendorId={vendorId} />}
      {section === "videos" && <VideoLibrary vendorId={vendorId} />}
      {section === "pricebook" && <PriceBookSettings vendorId={vendorId} />}
    </div>
  );
}
