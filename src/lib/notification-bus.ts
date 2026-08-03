// Petit bus d'événements client pour synchroniser instantanément les compteurs
// de notifications (cloche + navigation admin) après un "marquer comme lu".
const EVENT = "holiswiss:notifications-changed";

export function notifyNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function onNotificationsChanged(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
