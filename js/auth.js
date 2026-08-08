/* js/auth.js
 * Đăng nhập ứng dụng với tài khoản quản trị mặc định (admin / admin123).
 *
 * Lưu ý quan trọng về bảo mật:
 *  - Đây là lớp "khoá màn hình" ở phía trình duyệt (chặn người lạ mở app lên
 *    là dùng được luôn), KHÔNG phải xác thực server thật sự — vì app không
 *    có backend riêng. Mật khẩu được lưu dưới dạng băm (SHA-256 + salt),
 *    không lưu plaintext.
 *  - Dữ liệu tài chính vẫn nằm trên Firebase Realtime Database, vì vậy để
 *    bảo vệ dữ liệu thật sự (không chỉ giao diện), BẮT BUỘC phải đặt
 *    Firebase Security Rules cho Database ở mục Console Firebase — xem
 *    README.md phần "Bảo mật".
 *  - Thông tin đăng nhập (username + mật khẩu đã băm) được đồng bộ qua
 *    Firebase (`${FIREBASE_ROOT_PATH}/auth`) nên đổi mật khẩu ở một thiết bị
 *    sẽ áp dụng cho mọi thiết bị khác ngay lập tức.
 */

window.FE = window.FE || {};

(function (FE) {
  const SESSION_KEY = "fe_auth_session";
  const DEFAULT_USERNAME = "admin";
  const DEFAULT_PASSWORD = "admin123";

  let authConfig = null; // { username, salt, passwordHash, updatedAt } — bản mới nhất từ Firebase
  let authLoaded = false; // đã nhận được snapshot đầu tiên (kể cả null) chưa
  const readyWaiters = [];

  function onAuthConfigReady() {
    if (authLoaded) return Promise.resolve(authConfig);
    return new Promise((resolve) => {
      readyWaiters.push(resolve);
      // An toàn: nếu offline ngay từ lần chạy đầu tiên (chưa từng có cache),
      // Firebase có thể chưa từng bắn sự kiện "value" — không để màn hình
      // đăng nhập bị treo vô thời hạn, cho phép rơi về tài khoản mặc định.
      setTimeout(() => {
        if (!authLoaded) {
          authLoaded = true;
          readyWaiters.splice(0).forEach((r) => r(authConfig));
        }
      }, 4000);
    });
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    return sha256Hex(`${salt}:${password}`);
  }

  // Gọi khi kết nối Firebase xong — lắng nghe realtime cấu hình đăng nhập.
  function watchAuthConfig() {
    FE.firebase.watchObject("auth", (val) => {
      authConfig = val || null;
      if (!authLoaded) {
        authLoaded = true;
        readyWaiters.splice(0).forEach((r) => r(authConfig));
      }
    });
  }

  async function ensureDefaultAuthIfMissing() {
    await onAuthConfigReady();
    if (authConfig || !FE.firebase.isOnline()) return;
    // Chưa có tài khoản nào được thiết lập trên Firebase → khởi tạo tài
    // khoản quản trị mặc định (admin / admin123) để dùng ngay, không cần
    // cấu hình thủ công.
    const salt = randomSalt();
    const passwordHash = await hashPassword(DEFAULT_PASSWORD, salt);
    try {
      const saved = await FE.firebase.setObject("auth", {
        username: DEFAULT_USERNAME,
        salt,
        passwordHash,
      });
      authConfig = saved;
    } catch (e) {
      /* im lặng — vẫn còn cơ chế fallback mặc định khi đăng nhập */
    }
  }

  async function login(username, password) {
    const u = (username || "").trim();
    const p = password || "";
    if (!u || !p) return { ok: false, message: "Vui lòng nhập tài khoản và mật khẩu." };

    await onAuthConfigReady();

    let ok = false;
    if (authConfig && authConfig.username && authConfig.passwordHash) {
      const hash = await hashPassword(p, authConfig.salt || "");
      ok = u === authConfig.username && hash === authConfig.passwordHash;
    } else {
      // Chưa có cấu hình đồng bộ nào (lần đầu chạy / đang offline) → cho
      // phép đăng nhập bằng tài khoản mặc định.
      ok = u === DEFAULT_USERNAME && p === DEFAULT_PASSWORD;
      if (ok) ensureDefaultAuthIfMissing();
    }

    if (!ok) return { ok: false, message: "Sai tài khoản hoặc mật khẩu." };

    const session = { username: u, at: Date.now(), token: randomSalt() };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      /* ignore */
    }
    return { ok: true, session };
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  async function changePassword(oldPassword, newPassword) {
    await onAuthConfigReady();
    if (!newPassword || newPassword.length < 4) {
      return { ok: false, message: "Mật khẩu mới cần tối thiểu 4 ký tự." };
    }
    const username = (authConfig && authConfig.username) || DEFAULT_USERNAME;

    let currentOk;
    if (authConfig && authConfig.passwordHash) {
      const hash = await hashPassword(oldPassword || "", authConfig.salt || "");
      currentOk = hash === authConfig.passwordHash;
    } else {
      currentOk = (oldPassword || "") === DEFAULT_PASSWORD;
    }
    if (!currentOk) return { ok: false, message: "Mật khẩu hiện tại không đúng." };

    const salt = randomSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    const saved = await FE.firebase.setObject("auth", { username, salt, passwordHash });
    authConfig = saved;
    return { ok: true };
  }

  function getUsername() {
    return (authConfig && authConfig.username) || DEFAULT_USERNAME;
  }

  FE.auth = {
    watchAuthConfig,
    ensureDefaultAuthIfMissing,
    login,
    logout,
    isLoggedIn,
    getSession,
    changePassword,
    getUsername,
    DEFAULT_USERNAME,
    DEFAULT_PASSWORD,
  };
})(window.FE);
