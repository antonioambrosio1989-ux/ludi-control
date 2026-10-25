/*
 * Service Worker per le notifiche web di Ludis League.
 * La registrazione FCM e il token sono gestiti da PushNotificationService.ts
 * nella pagina principale. Questo worker gestisce i messaggi push ricevuti
 * in background e l'apertura dei link quando si clicca una notifica.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { body: event.data.text() } };
  }

  const notification = payload?.notification ?? {};
  const data = payload?.data ?? {};
  const title = data.title || notification.title || "Ludis League";
  const body = data.body || notification.body || "Hai un nuovo aggiornamento.";
  const link = data.link || notification.click_action || "/";
  const icon = data.icon || notification.icon || "/icons/icon-192.png";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icons/icon-192.png",
      tag: data.category ? `ludi-${data.category}` : undefined,
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawLink = event.notification?.data?.link || "/";
  // Consentiamo soltanto URL della stessa origine.
  const target = new URL(rawLink, self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target.href);
      } else {
        await clients.openWindow(target.href);
      }
    })(),
  );
});
