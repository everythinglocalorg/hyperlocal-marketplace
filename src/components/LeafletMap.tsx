"use client";

import { useEffect, useRef } from "react";

export type MapMarker = { lat: number; lng: number; title: string; href?: string; subtitle?: string };

// Interactive map via Leaflet + OpenStreetMap tiles (no API key, no billing).
// Leaflet is loaded from CDN on demand so there's no npm dependency or SSR issue.
// Pass one marker for a single location, or many for a multi-pin map (auto-fits).

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return leafletPromise;
}

const PIN_HTML =
  '<svg width="30" height="30" viewBox="0 0 24 24" fill="#16a34a" stroke="white" stroke-width="1.5" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="white" stroke="none"/></svg>';

export default function LeafletMap({ markers, height = 288, zoom, className = "" }: {
  markers: MapMarker[];
  height?: number;
  zoom?: number;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const key = JSON.stringify(markers);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({ className: "el-pin", html: PIN_HTML, iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26] });
      const pts: [number, number][] = [];
      markers.forEach((m) => {
        if (typeof m.lat !== "number" || typeof m.lng !== "number") return;
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        const safeTitle = (m.title || "").replace(/</g, "&lt;");
        const safeSub = (m.subtitle || "").replace(/</g, "&lt;");
        const body =
          `<div style="min-width:140px"><strong>${safeTitle}</strong>` +
          (safeSub ? `<br><span style="color:#6b7280;font-size:12px">${safeSub}</span>` : "") +
          (m.href ? `<br><a href="${m.href}" style="color:#16a34a;font-weight:600;font-size:13px;text-decoration:none">View →</a>` : "") +
          `</div>`;
        marker.bindPopup(body);
        pts.push([m.lat, m.lng]);
      });

      if (pts.length === 1) map.setView(pts[0], zoom ?? 14);
      else if (pts.length > 1) map.fitBounds(pts, { padding: [34, 34], maxZoom: 15 });
      else map.setView([44.811, -91.498], 11); // fallback: Eau Claire, WI

      // The container can have zero size when the map inits (hidden tab, not yet
      // laid out) — recompute tiles whenever it actually gets/changes size.
      map.invalidateSize();
      if (typeof ResizeObserver !== "undefined" && elRef.current) {
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(elRef.current);
        roRef.current = ro;
      }
    }).catch(() => { /* CDN unavailable — map just doesn't render */ });

    return () => {
      cancelled = true;
      if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [key, zoom]);

  return <div ref={elRef} style={{ height }} className={`w-full bg-gray-100 rounded-2xl overflow-hidden relative z-0 ${className}`} />;
}
