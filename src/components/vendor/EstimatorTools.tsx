"use client";
import { useState } from "react";
import PriceBookSettings from "@/components/vendor/PriceBookSettings";
import TemplateManager from "@/components/vendor/TemplateManager";
import SnippetManager from "@/components/vendor/SnippetManager";
import VideoLibrary from "@/components/vendor/VideoLibrary";
import PhotoLibrary from "@/components/vendor/PhotoLibrary";
import SubstrateManager from "@/components/vendor/SubstrateManager";
import EstimatorSettings from "@/components/vendor/EstimatorSettings";

type Section = "templates" | "substrates" | "pricebook" | "snippets" | "videos" | "settings";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "substrates", label: "Production Rates", icon: "📐" },
  { id: "pricebook", label: "Products", icon: "🎨" },
  { id: "snippets", label: "Text & Notes", icon: "✍️" },
  { id: "videos", label: "Video + Photo Library", icon: "🎬" },
  { id: "templates", label: "Templates", icon: "🧱" },
];

// Hub for everything a vendor sets up once and reuses across proposals.
export default function EstimatorTools({ vendorId, userId }: { vendorId: string; userId: string }) {
  const [section, setSection] = useState<Section>("settings");

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
      {section === "substrates" && <SubstrateManager vendorId={vendorId} />}
      {section === "pricebook" && <PriceBookSettings vendorId={vendorId} />}
      {section === "snippets" && <SnippetManager vendorId={vendorId} />}
      {section === "videos" && (
        <div className="space-y-8">
          <PhotoLibrary vendorId={vendorId} userId={userId} />
          <div className="border-t border-gray-100 pt-6"><VideoLibrary vendorId={vendorId} /></div>
        </div>
      )}
      {section === "settings" && <EstimatorSettings vendorId={vendorId} />}
    </div>
  );
}
