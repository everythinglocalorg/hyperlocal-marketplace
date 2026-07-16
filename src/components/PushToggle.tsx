"use client";

import { useEffect, useState } from "react";

// Opt-in control for push notifications. Registers the service worker, asks for
// permission, and stores the subscription against the signed-in user.
//
// Notes:
// - iOS only allows Web Push for a PWA that's been Added to Home Screen, so we
//   detect that case and tell the user instead of showing a dead button.
// - Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY.

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "misconfigured" | "ios-needs-install" | "denied" | "off" | "on";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // iOS Safari only exposes PushManager once installed to the home screen.
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setState(isIOS && !standalone ? "ios-needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { setState("denied"); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      const existing = await reg?.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      // Check config BEFORE prompting — otherwise we'd ask for permission and
      // then bail, which looks like success but saves nothing.
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) { setState("misconfigured"); return; }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const box = "border border-gray-100 rounded-2xl p-4 bg-white flex items-start gap-3";

  if (state === "ios-needs-install") {
    return (
      <div className={box}>
        <span className="text-xl leading-none">🔔</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Turn on notifications</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            On iPhone, tap <strong>Share</strong> → <strong>Add to Home Screen</strong> first, then open
            Everything Local from your home screen to enable notifications.
          </p>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={box}>
        <span className="text-xl leading-none">🔕</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Notifications are blocked</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Re-enable them for this site in your browser&apos;s site settings, then reload.
          </p>
        </div>
      </div>
    );
  }

  // Push keys missing from the build (NEXT_PUBLIC_* are inlined at build time,
  // so this means the app was built before the VAPID key was set).
  if (state === "misconfigured") {
    return (
      <div className={box}>
        <span className="text-xl leading-none">⚙️</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Notifications aren&apos;t set up yet</p>
          <p className="text-xs text-gray-500 mt-0.5">Push isn&apos;t configured for this build. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${box} items-center justify-between`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{state === "on" ? "🔔" : "🔕"}</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {state === "on" ? "Notifications are on" : "Get notified instantly"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {state === "on"
              ? "You'll get a push when someone messages you or acts on your listings."
              : "Messages, offers, and bookings — even when the site is closed."}
          </p>
        </div>
      </div>
      <button
        onClick={state === "on" ? disable : enable}
        disabled={busy}
        className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-colors disabled:opacity-50 ${
          state === "on"
            ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}
