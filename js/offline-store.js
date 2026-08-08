/* js/offline-store.js
 * Lớp lưu trữ offline bằng IndexedDB.
 *
 * Vai trò:
 *  1) CACHE: mỗi khi Firebase trả về dữ liệu mới nhất của một collection,
 *     lưu một bản sao vào IndexedDB. Khi mở app lúc KHÔNG có mạng, app đọc
 *     ngay bản cache này để hiển thị được dữ liệu thay vì màn hình trắng.
 *  2) HÀNG ĐỢI GHI (write queue): khi thêm/sửa/xoá lúc offline, thao tác
 *     được lưu bền vào IndexedDB (không mất khi tắt app/mất mạng) và sẽ
 *     được gửi lên Firebase tự động ngay khi có mạng trở lại — theo đúng
 *     thứ tự, không ghi đè âm thầm dữ liệu mới hơn từ thiết bị khác
 *     (dùng lại cơ chế transaction/conflict-check trong js/firebase.js).
 *
 * IndexedDB ở đây CHỈ đóng vai trò cache + hàng đợi đồng bộ — Firebase
 * Realtime Database vẫn là nguồn dữ liệu chuẩn (single source of truth)
 * mỗi khi có kết nối mạng.
 */

window.FE = window.FE || {};

(function (FE) {
  const DB_NAME = "fe_offline_store";
  const DB_VERSION = 1;
  const STORE_CACHE = "collectionCache"; // key: collection name -> { list, updatedAt }
  const STORE_QUEUE = "writeQueue"; // autoIncrement: pending mutations
  const STORE_META = "meta"; // key/value misc (vd: settings object)

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Trình duyệt không hỗ trợ IndexedDB"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: "collection" });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: "qid", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Không mở được IndexedDB"));
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- Cache của từng collection ----------
  async function saveCollectionCache(collection, list) {
    try {
      const store = await tx(STORE_CACHE, "readwrite");
      await reqToPromise(store.put({ collection, list, cachedAt: Date.now() }));
    } catch (e) {
      console.warn("Không lưu được cache offline:", e);
    }
  }

  async function loadCollectionCache(collection) {
    try {
      const store = await tx(STORE_CACHE, "readonly");
      const row = await reqToPromise(store.get(collection));
      return row ? row.list : [];
    } catch (e) {
      return [];
    }
  }

  async function saveMeta(key, value) {
    try {
      const store = await tx(STORE_META, "readwrite");
      await reqToPromise(store.put({ key, value }));
    } catch (e) {
      /* ignore */
    }
  }

  async function loadMeta(key) {
    try {
      const store = await tx(STORE_META, "readonly");
      const row = await reqToPromise(store.get(key));
      return row ? row.value : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- Hàng đợi ghi khi offline ----------
  // op: { type: 'add'|'update'|'remove', collection, tempId?, id?, data?, changes?, baseUpdatedAt?, ts }
  async function enqueue(op) {
    const store = await tx(STORE_QUEUE, "readwrite");
    op.ts = Date.now();
    const qid = await reqToPromise(store.add(op));
    return qid;
  }

  async function listQueue() {
    const store = await tx(STORE_QUEUE, "readonly");
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => a.qid - b.qid);
  }

  async function removeFromQueue(qid) {
    const store = await tx(STORE_QUEUE, "readwrite");
    await reqToPromise(store.delete(qid));
  }

  async function queueLength() {
    const all = await listQueue();
    return all.length;
  }

  FE.offlineStore = {
    saveCollectionCache,
    loadCollectionCache,
    saveMeta,
    loadMeta,
    enqueue,
    listQueue,
    removeFromQueue,
    queueLength,
  };
})(window.FE);
