/* Çiftçi Dostum servis çalışanı: çevrimdışı çalışma + bildirimler */
const VERSION = "20261116140255";
const CACHE = "cd-" + VERSION;
const BASE = self.registration.scope; // ör. https://kullanici.github.io/ciftcidostum/
const U = (p) => new URL(p, BASE).href;
const SHELL = [U("./"), U("index.html"), U("config.js"), U("manifest.webmanifest"), U("icons/icon-192.png"), U("icons/icon-512.png"), U("icons/apple-touch-icon.png"),
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("cd-") && k !== CACHE && k !== "cd-photos").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Supabase API ve kimlik: her zaman ağdan (önbelleğe alma)
  if (url.hostname.endsWith(".supabase.co")) {
    // Fotoğraflar (imzalı bağlantılar) çevrimdışı da görünsün
    if (url.pathname.includes("/storage/v1/object/sign/")) {
      e.respondWith(caches.open("cd-photos").then(async (c) => {
        const key = url.origin + url.pathname; // imza parametresi değişse de aynı dosya
        const hit = await c.match(key);
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok) c.put(key, r.clone());
        return r;
      }));
    }
    return;
  }
  // Sayfa açılışları: önce ağ, yoksa önbellek
  if (req.mode === "navigate") {
    const isAdmin = url.href.startsWith(U("admin/"));
    const key = isAdmin ? U("admin/") : U("index.html");
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(key, cp)); } return r; })
      .catch(() => caches.match(key).then((r) => r || caches.match(U("./")))));
    return;
  }
  // Diğer dosyalar (simgeler, kütüphane, yazı tipleri): önbellek, arka planda güncelle
  if (url.origin === location.origin || /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Çiftçi Dostum", {
    body: d.body || "", icon: U("icons/icon-192.png"), badge: U("icons/badge-96.png"), tag: d.tag || undefined, data: { url: U(d.url || "./") },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url || BASE;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ("focus" in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
