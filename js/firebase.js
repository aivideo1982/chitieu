/* js/firebase.js
 * Lớp lõi kết nối & đồng bộ Firebase Realtime Database, có OFFLINE MODE thật:
 *  - Firebase Realtime Database là nguồn dữ liệu CHUẨN khi có mạng
 *    (single source of truth).
 *  - IndexedDB (js/offline-store.js) giữ một bản CACHE của dữ liệu mới nhất
 *    để mở app được ngay cả khi không có mạng, và giữ một HÀNG ĐỢI GHI cho
 *    các thao tác thêm/sửa/xoá thực hiện lúc offline — hàng đợi này bền
 *    (sống sót qua việc tắt app/mất mạng) và tự động gửi lên Firebase khi
 *    có mạng trở lại, KHÔNG bao giờ tự ý ghi đè dữ liệu mới hơn từ thiết bị
 *    khác (vẫn dùng transaction kiểm tra xung đột như trước).
 */

window.FE = window.FE || {};

(function (FE) {
  const URL_STORAGE_KEY = "fe_firebase_database_url";

  let app = null;
  let db = null;
  let connectedUrl = null;
  let currentStatus = "offline";
  const statusListeners = [];
  const collectionListeners = {}; // path -> firebase ref (for cleanup)

  // ----- Trạng thái đồng bộ nội bộ dùng cho chế độ Offline -----
  const authoritative = {}; // collection -> danh sách mới nhất từ Firebase (hoặc cache lúc khởi động)
  const lastCallback = {}; // collection -> callback UI đang lắng nghe
  let queueCache = []; // bản sao trong bộ nhớ của hàng đợi ghi (IndexedDB)
  let flushing = false;

  function getSavedUrl() {
    try {
      return localStorage.getItem(URL_STORAGE_KEY) || FIREBASE_DATABASE_URL;
    } catch (e) {
      return FIREBASE_DATABASE_URL;
    }
  }

  function saveUrl(url) {
    try {
      localStorage.setItem(URL_STORAGE_KEY, url);
    } catch (e) {
      /* ignore */
    }
  }

  function onStatusChange(cb) {
    statusListeners.push(cb);
  }

  function emitStatus(status, detail) {
    currentStatus = status;
    statusListeners.forEach((cb) => {
      try {
        cb(status, detail);
      } catch (e) {
        console.error(e);
      }
    });
    if (status === "online") flushQueue();
  }

  function isValidDatabaseUrl(url) {
    return /^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(
      (url || "").trim()
    );
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }

  // Khởi tạo / kết nối lại Firebase với một Database URL cụ thể.
  // Nếu không có mạng lúc này, KHÔNG báo lỗi và chặn người dùng — app vẫn
  // "kết nối" (ghi nhớ cấu hình) và chạy ở chế độ offline bằng dữ liệu cache,
  // sẽ tự đồng bộ ngay khi có mạng trở lại.
  async function connect(databaseUrl) {
    const url = (databaseUrl || "").trim().replace(/\/+$/, "");
    if (!isValidDatabaseUrl(url)) {
      throw new Error(
        "Firebase Database URL không hợp lệ. Ví dụ: https://ten-project-default-rtdb.firebaseio.com"
      );
    }

    emitStatus("connecting");

    if (app) {
      try {
        await app.delete();
      } catch (e) {
        /* ignore */
      }
      app = null;
      db = null;
    }

    try {
      app = firebase.initializeApp({ databaseURL: url }, "fe-" + Date.now());
      db = firebase.database(app);

      connectedUrl = url;
      saveUrl(url);
      await FE.offlineStore.saveMeta("lastConnectedUrl", url);

      // Theo dõi trạng thái kết nối mạng tới Firebase (.info/connected).
      db.ref(".info/connected").on("value", (snap) => {
        emitStatus(snap.val() === true ? "online" : "offline");
      });

      // Kiểm tra đọc/ghi thật để xác nhận URL hoạt động — nhưng KHÔNG chặn
      // việc dùng app nếu không có mạng ngay lúc này (chỉ là chưa xác minh).
      try {
        const testRef = db.ref(`${FIREBASE_ROOT_PATH}/settings/_connectionTest`);
        await withTimeout(testRef.set({ pingAt: Date.now() }), 5000);
      } catch (pingErr) {
        // Có thể do offline — vẫn cho phép tiếp tục ở chế độ offline.
        console.warn("Chưa xác minh được kết nối (có thể đang offline):", pingErr.message);
      }

      await loadQueueFromStore();
      emitStatus(currentStatus === "online" ? "online" : "offline");
      return true;
    } catch (err) {
      app = null;
      db = null;
      emitStatus("error", err.message || String(err));
      throw err;
    }
  }

  function isConnected() {
    return !!db;
  }

  function isOnline() {
    return isConnected() && currentStatus === "online" && navigator.onLine;
  }

  function getConnectedUrl() {
    return connectedUrl;
  }

  function collectionPath(collection) {
    return `${FIREBASE_ROOT_PATH}/${collection}`;
  }

  // ---------- Gộp dữ liệu chuẩn (Firebase/cache) với hàng đợi chưa gửi ----------
  function computeEffectiveList(collection) {
    const base = authoritative[collection] || [];
    const ops = queueCache.filter((o) => o.collection === collection);
    if (ops.length === 0) return base;

    const byId = new Map(base.map((r) => [r.id, { ...r }]));
    ops.forEach((op) => {
      if (op.type === "add") {
        byId.set(op.tempId, { ...op.data, id: op.tempId, _pending: true, createdAt: op.ts, updatedAt: op.ts });
      } else if (op.type === "update") {
        const existing = byId.get(op.id);
        if (existing) byId.set(op.id, { ...existing, ...op.changes, _pending: true, updatedAt: op.ts });
      } else if (op.type === "remove") {
        byId.delete(op.id);
      }
    });
    return Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function notify(collection) {
    const cb = lastCallback[collection];
    if (cb) cb(computeEffectiveList(collection));
  }

  async function loadQueueFromStore() {
    queueCache = await FE.offlineStore.listQueue();
  }

  // Lắng nghe realtime toàn bộ một collection (vd: transactions, accounts...).
  // Khi offline / chưa kết nối: trả về ngay dữ liệu cache đã lưu ở lần chạy
  // trước, rồi tự cập nhật lại khi có dữ liệu thật từ Firebase.
  function watchCollection(collection, callback) {
    lastCallback[collection] = callback;

    // 1) Nạp cache offline ngay lập tức để không có màn hình trắng khi mất mạng.
    FE.offlineStore.loadCollectionCache(collection).then((cached) => {
      if (!authoritative[collection]) {
        authoritative[collection] = cached;
        notify(collection);
      }
    });

    if (!db) return () => { delete lastCallback[collection]; };

    const ref = db.ref(collectionPath(collection));
    const handler = (snap) => {
      const val = snap.val() || {};
      const list = Object.keys(val).map((id) => ({ id, ...val[id] }));
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      authoritative[collection] = list;
      FE.offlineStore.saveCollectionCache(collection, list);
      notify(collection);
    };
    ref.on("value", handler);
    collectionListeners[collection] = { ref, handler };
    return () => {
      ref.off("value", handler);
      delete lastCallback[collection];
    };
  }

  function stopWatch(collection) {
    const l = collectionListeners[collection];
    if (l) {
      l.ref.off("value", l.handler);
      delete collectionListeners[collection];
    }
  }

  // Lắng nghe một object đơn (vd: settings chung của gia đình).
  function watchObject(path, callback) {
    FE.offlineStore.loadMeta("obj:" + path).then((cached) => {
      if (cached) callback(cached);
    });
    if (!db) return () => {};
    const ref = db.ref(`${FIREBASE_ROOT_PATH}/${path}`);
    const handler = (snap) => {
      const val = snap.val() || null;
      FE.offlineStore.saveMeta("obj:" + path, val);
      callback(val);
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
  }

  // ADD → Firebase push(); nếu offline, đưa vào hàng đợi và cập nhật UI
  // ngay bằng một bản ghi tạm (_pending: true) cho tới khi gửi thành công.
  async function addRecord(collection, data) {
    if (isOnline()) {
      const ref = db.ref(collectionPath(collection)).push();
      const now = Date.now();
      const record = { ...data, id: ref.key, createdAt: now, updatedAt: now };
      await ref.set(record);
      return record;
    }
    const tempId = "local_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await FE.offlineStore.enqueue({ type: "add", collection, tempId, data });
    await loadQueueFromStore();
    notify(collection);
    FE.util && FE.util.toast && FE.util.toast("Đang offline — đã lưu tạm, sẽ tự đồng bộ khi có mạng", "info");
    return { ...data, id: tempId, _pending: true, createdAt: Date.now(), updatedAt: Date.now() };
  }

  // UPDATE → Firebase update(), có kiểm tra xung đột theo updatedAt.
  // Nếu offline: đưa vào hàng đợi, áp dụng optimistic update cho UI.
  async function updateRecord(collection, id, changes, baseUpdatedAt) {
    if (isOnline() && !String(id).startsWith("local_")) {
      const ref = db.ref(`${collectionPath(collection)}/${id}`);
      let conflict = false;
      const result = await ref.transaction((current) => {
        if (current === null) return current;
        if (
          typeof baseUpdatedAt === "number" &&
          current.updatedAt &&
          current.updatedAt > baseUpdatedAt
        ) {
          conflict = true;
          return; // abort — không ghi đè dữ liệu mới hơn từ thiết bị khác
        }
        return { ...current, ...changes, id, updatedAt: Date.now() };
      });
      return { committed: result.committed, conflict, value: result.snapshot.val() };
    }
    await FE.offlineStore.enqueue({ type: "update", collection, id, changes, baseUpdatedAt });
    await loadQueueFromStore();
    notify(collection);
    FE.util && FE.util.toast && FE.util.toast("Đang offline — thay đổi đã lưu tạm", "info");
    return { committed: true, conflict: false, value: null, pending: true };
  }

  // DELETE → Firebase remove(); nếu offline, đưa vào hàng đợi.
  async function removeRecord(collection, id) {
    if (isOnline() && !String(id).startsWith("local_")) {
      return db.ref(`${collectionPath(collection)}/${id}`).remove();
    }
    await FE.offlineStore.enqueue({ type: "remove", collection, id });
    await loadQueueFromStore();
    notify(collection);
    FE.util && FE.util.toast && FE.util.toast("Đang offline — sẽ xoá khi có mạng", "info");
    return true;
  }

  // Ghi đè/khởi tạo một object đơn (vd settings) — vẫn qua update() theo path con.
  async function setObject(path, data) {
    const now = Date.now();
    const merged = { ...data, updatedAt: now };
    if (isOnline()) {
      await db.ref(`${FIREBASE_ROOT_PATH}/${path}`).update(merged);
    } else {
      await FE.offlineStore.enqueue({ type: "setObject", collection: "__obj__" + path, changes: merged });
      await loadQueueFromStore();
    }
    FE.offlineStore.saveMeta("obj:" + path, merged);
    return merged;
  }

  function getServerTimeOffset(cb) {
    if (!db) return cb(0);
    db.ref(".info/serverTimeOffset").once("value", (snap) => cb(snap.val() || 0));
  }

  // ---------- Gửi hàng đợi lên Firebase khi có mạng trở lại ----------
  async function flushQueue() {
    if (flushing || !isOnline()) return;
    flushing = true;
    try {
      await loadQueueFromStore();
      const idMap = {}; // tempId cũ -> id thật do Firebase cấp
      for (const op of queueCache.slice().sort((a, b) => a.qid - b.qid)) {
        try {
          if (op.type === "add") {
            const ref = db.ref(collectionPath(op.collection)).push();
            const now = Date.now();
            const record = { ...op.data, id: ref.key, createdAt: now, updatedAt: now };
            await ref.set(record);
            idMap[op.tempId] = ref.key;
          } else if (op.type === "update") {
            const realId = idMap[op.id] || op.id;
            if (!String(realId).startsWith("local_")) {
              await db.ref(`${collectionPath(op.collection)}/${realId}`).update({
                ...op.changes,
                updatedAt: Date.now(),
              });
            }
          } else if (op.type === "remove") {
            const realId = idMap[op.id] || op.id;
            if (!String(realId).startsWith("local_")) {
              await db.ref(`${collectionPath(op.collection)}/${realId}`).remove();
            }
          } else if (op.type === "setObject") {
            const path = op.collection.replace(/^__obj__/, "");
            await db.ref(`${FIREBASE_ROOT_PATH}/${path}`).update(op.changes);
          }
          await FE.offlineStore.removeFromQueue(op.qid);
        } catch (e) {
          console.error("Đồng bộ hàng đợi thất bại cho một thao tác, sẽ thử lại sau:", e);
          break; // giữ nguyên phần còn lại trong hàng đợi, thử lại ở lần sau
        }
      }
      await loadQueueFromStore();
      Object.keys(lastCallback).forEach((collection) => notify(collection));
      if (queueCache.length === 0) {
        FE.util && FE.util.toast && FE.util.toast("Đã đồng bộ xong toàn bộ dữ liệu offline", "success");
      }
    } finally {
      flushing = false;
    }
  }

  // Đọc một lần (không lắng nghe realtime) — dùng để kiểm tra dữ liệu đã
  // tồn tại hay chưa (vd trước khi tự khởi tạo tài khoản/danh mục mặc định),
  // tránh việc seed dữ liệu mẫu đè lên dữ liệu thật của người dùng.
  async function getCollectionOnce(collection) {
    if (!db) return null;
    const snap = await db.ref(collectionPath(collection)).once("value");
    const val = snap.val() || {};
    return Object.keys(val).map((id) => ({ id, ...val[id] }));
  }

  async function pendingCount() {
    await loadQueueFromStore();
    return queueCache.length;
  }

  window.addEventListener("online", () => flushQueue());

  // ---------- Presence: hiển thị các thiết bị đang online theo thời gian
  // thực (đăng nhập → ghi presence; mất kết nối/đóng tab → Firebase tự xoá
  // qua onDisconnect(), không cần polling). ----------
  let presenceRef = null;

  function presencePath(sessionId) {
    return `${FIREBASE_ROOT_PATH}/presence/${sessionId}`;
  }

  async function goOnlinePresence(sessionId, data) {
    if (!db) return;
    try {
      presenceRef = db.ref(presencePath(sessionId));
      await presenceRef.onDisconnect().remove();
      await presenceRef.set({ ...data, connectedAt: Date.now() });
    } catch (e) {
      console.warn("Không thể ghi presence:", e.message);
    }
  }

  function watchPresence(callback) {
    if (!db) return () => {};
    const ref = db.ref(`${FIREBASE_ROOT_PATH}/presence`);
    const handler = (snap) => {
      const val = snap.val() || {};
      callback(Object.keys(val).map((id) => ({ id, ...val[id] })));
    };
    ref.on("value", handler);
    return () => ref.off("value", handler);
  }

  async function clearPresence(sessionId) {
    try {
      await db?.ref(presencePath(sessionId)).remove();
    } catch (e) {
      /* ignore */
    }
    presenceRef = null;
  }

  FE.firebase = {
    connect,
    isConnected,
    isOnline,
    getConnectedUrl,
    getSavedUrl,
    isValidDatabaseUrl,
    onStatusChange,
    watchCollection,
    stopWatch,
    watchObject,
    addRecord,
    updateRecord,
    removeRecord,
    setObject,
    getServerTimeOffset,
    flushQueue,
    pendingCount,
    goOnlinePresence,
    watchPresence,
    clearPresence,
    getCollectionOnce,
  };
})(window.FE);
