/* Service worker minimal : rend l'appli installable sur l'écran d'accueil.
   Aucune mise en cache : tout passe par le réseau, donc chaque mise à jour est visible immédiatement. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
