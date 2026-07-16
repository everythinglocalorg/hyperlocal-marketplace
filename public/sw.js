// Everything Local service worker — Web Push only (no offline caching yet).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Show a notification when the server pushes one.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Everything Local", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Everything Local";
  const options = {
    body: data.body || "",
    icon: data.icon || "/api/icon/192",
    badge: "/api/icon/192",
    tag: data.tag || undefined,      // same tag replaces an existing notification
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab on the target URL if there is one, else open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url.includes(target)) return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
