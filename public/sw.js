/*
 * Service worker do NutriDia.
 *
 * Leitura offline do que já passou pela tela, sem nunca mentir sobre o que
 * está gravado.
 *
 * A regra que importa: só entra em cache o que é imutável por natureza
 * (/_next/static tem hash no nome, ícone e manifest quase não mudam). Dado do
 * app — HTML de navegação e payload de troca de aba do Next — vai sempre na
 * rede primeiro, e o cache só serve quando a rede falhou.
 *
 * A versão anterior guardava em cache tudo que não fosse navegação. Como a
 * troca de aba do Next busca os dados por uma requisição comum (não uma
 * navegação), o diário voltava do cache para sempre: comida apagada
 * reaparecia e o anel do topo não zerava.
 */
const VERSAO = "nutridia-v4";
const OFFLINE = "/offline";

/** Só o que pode ser servido do cache sem risco de estar velho. */
function ehEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

/** Troca de aba do Next: dado do app disfarçado de requisição comum. */
function ehDadoDoApp(url, req) {
  return (
    url.searchParams.has("_rsc") ||
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Router-Prefetch") === "1"
  );
}

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

  // Dado do app nunca sai do cache: número errado é pior que tela em branco.
  if (ehDadoDoApp(url, req)) return;

  if (ehEstatico(url)) {
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
    return;
  }

  // Todo o resto — inclusive navegação — é rede primeiro.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (req.mode === "navigate" && res.ok) {
          const copia = res.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((r) => r || (req.mode === "navigate" ? caches.match(OFFLINE) : undefined)),
      ),
  );
});
