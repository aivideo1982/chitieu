/* sw.js
 * Chỉ cache các tệp giao diện tĩnh (app shell) để hỗ trợ cài đặt & offline.
 * KHÔNG bao giờ can thiệp vào request tới Firebase — dữ liệu tài chính luôn
 * lấy trực tiếp từ Firebase Realtime Database (qua js/firebase.js +
 * js/offline-store.js), không qua cache của Service Worker.
 * KHÔNG xoá bất kỳ dữ liệu người dùng nào khi cập nhật phiên bản — Service
 * Worker chỉ quản lý các tệp mã nguồn/giao diện, không đụng tới IndexedDB.
 *
 * Tăng CACHE_VERSION mỗi khi phát hành bản mới để buộc tải lại app shell.
 */

const CACHE_VERSION = "fe-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./version.json",
  "./firebase-config.js",
  "./js/offline-store.js",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/seed.js",
  "./js/app.js",
  "./js/dashboard.js",
  "./js/transactions.js",
  "./js/budget.js",
  "./js/reports.js",
  "./js/family.js",
  "./js/accounts.js",
  "./js/categories.js",
  "./js/notifications.js",
  "./js/backup.js",
  "./js/settings.js",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch((err) => {
      // Không chặn cài đặt nếu một số tệp không cache được (vd offline lần đầu)
      console.warn("SW install cache warning:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("fe-shell-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Không cache/chặn bất kỳ request nào tới Firebase hoặc domain khác (Google APIs,
  // fonts, CDN Firebase SDK, v.v.) — luôn đi thẳng ra mạng để đảm bảo dữ liệu
  // luôn mới nhất. offline-store.js (IndexedDB) đã lo phần cache dữ liệu.
  if (url.origin !== self.location.origin) {
    return; // để trình duyệt xử lý request bình thường
  }

  if (event.request.method !== "GET") return;

  // Điều hướng trang (vd mở app từ icon màn hình chính khi offline) → luôn
  // trả về index.html đã cache thay vì lỗi mạng.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Ưu tiên mạng khi có, dùng cache khi offline — không bao giờ dùng cache
      // để ghi đè dữ liệu (service worker này không đụng tới dữ liệu Firebase).
      return networkFetch.catch(() => cached);
    })
  );
});
