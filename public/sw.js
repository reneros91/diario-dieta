/*
 * Service worker do Balanço.
 *
 * Leitura offline do que já passou pela tela: navegação usa rede primeiro e cai
 * no cache quando não há sinal; estáticos usam cache primeiro. Nada de POST,
 * nada de API de IA — registrar comida offline daria número errado.
 */
const VERSAO = "balanco-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSAO).then((c) => c.addAll([OFFLINE, "/manifest.webmanifest"])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cacheado) =>
        cacheado ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copia = res.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return res;
        }),
    ),
  );
});
