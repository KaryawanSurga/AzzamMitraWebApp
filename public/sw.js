const OFFLINE_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Sedang offline — Azzam Mitra</title>
    <style>
      body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem; background: #f6f4ee; color: #1f2a21; font-family: system-ui, sans-serif; }
      main { max-width: 24rem; text-align: center; }
      h1 { font-size: 1.25rem; }
      p { line-height: 1.6; color: #55605a; }
      button { margin-top: 1rem; border: 0; border-radius: 999px; padding: .8rem 1.4rem; background: #24462c; color: #fff; font-size: 1rem; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Koneksi terputus</h1>
      <p>Data yang sedang Anda isi tetap tersimpan di perangkat. Periksa internet lalu buka kembali aplikasi.</p>
      <button type="button" onclick="location.reload()">Coba lagi</button>
    </main>
  </body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
    return;
  }
  event.respondWith(fetch(request));
});
