/* js/app.js — điều phối chung của ứng dụng */
window.FE = window.FE || {};

(function (FE) {
  const COLLECTIONS = [
    "transactions",
    "accounts",
    "categories",
    "budgets",
    "familyMembers",
    "recurringPayments",
  ];

  FE.state = {
    transactions: [],
    accounts: [],
    categories: [],
    budgets: [],
    familyMembers: [],
    recurringPayments: [],
    settings: null,
    connectionStatus: "offline", // connecting | online | offline | error
    connectedUrl: null,
  };

  const activeUnsubs = [];

  // ---------- Helpers dùng chung ----------
  FE.util = {
    uid() {
      return Math.random().toString(36).slice(2, 10);
    },
    formatCurrency(n) {
      const num = Number(n) || 0;
      return num.toLocaleString("vi-VN") + " ₫";
    },
    formatDate(ts) {
      if (!ts) return "—";
      const d = new Date(ts);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
    formatDateTime(ts) {
      if (!ts) return "—";
      const d = new Date(ts);
      return d.toLocaleString("vi-VN");
    },
    escapeHtml(str) {
      return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]));
    },
    byId(collection, id) {
      return (FE.state[collection] || []).find((r) => r.id === id);
    },
    toast(message, kind = "info") {
      const el = document.getElementById("toast");
      if (!el) return;
      el.textContent = message;
      el.className = `toast show toast--${kind}`;
      clearTimeout(FE.util._toastTimer);
      FE.util._toastTimer = setTimeout(() => {
        el.className = "toast";
      }, 3200);
    },
  };

  // ---------- Trạng thái kết nối ----------
  function setStatusUI(status, detail) {
    FE.state.connectionStatus = status;
    const dot = document.getElementById("statusDot");
    const label = document.getElementById("statusLabel");
    if (!dot || !label) return;

    const map = {
      connecting: { cls: "dot--sync", text: "🟠 Đang kết nối…" },
      connected: { cls: "dot--sync", text: "🟠 Đang đồng bộ…" },
      online: { cls: "dot--online", text: "🟢 Online • Đã đồng bộ" },
      offline: { cls: "dot--offline", text: "🔴 Offline • Chờ kết nối" },
      error: { cls: "dot--offline", text: "🔴 Lỗi kết nối" + (detail ? `: ${detail}` : "") },
    };
    const info = map[status] || map.offline;
    dot.className = "status-dot " + info.cls;
    label.textContent = info.text;
  }

  FE.firebase.onStatusChange(setStatusUI);
  FE.firebase.onStatusChange((status) => {
    if (status === "online") FE.seed.ensureDefaultData();
  });

  async function refreshPendingBadge() {
    const bar = document.getElementById("pendingBar");
    const label = document.getElementById("pendingLabel");
    if (!bar || !label || !FE.firebase.pendingCount) return;
    const n = await FE.firebase.pendingCount();
    if (n > 0) {
      bar.style.display = "flex";
      label.textContent = `${n} thay đổi chờ đồng bộ`;
    } else {
      bar.style.display = "none";
    }
  }
  FE.firebase.onStatusChange(() => setTimeout(refreshPendingBadge, 400));

  // ---------- Cài đặt lên màn hình chính (Android/Chrome) ----------
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("installBtn");
    if (btn) btn.style.display = "block";
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("installBtn")?.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      document.getElementById("installBtn").style.display = "none";
    });
  });
  window.addEventListener("appinstalled", () => {
    FE.util.toast("Đã cài ứng dụng lên máy", "success");
  });

  // ---------- Kết nối & lắng nghe dữ liệu ----------
  async function startRealtimeSync() {
    activeUnsubs.forEach((u) => u());
    activeUnsubs.length = 0;

    COLLECTIONS.forEach((col) => {
      const unsub = FE.firebase.watchCollection(col, (list) => {
        FE.state[col] = list;
        document.dispatchEvent(new CustomEvent("fe:update", { detail: { collection: col } }));
      });
      activeUnsubs.push(unsub);
    });

    const unsubSettings = FE.firebase.watchObject("settings", (obj) => {
      FE.state.settings = obj;
      document.dispatchEvent(new CustomEvent("fe:update", { detail: { collection: "settings" } }));
    });
    activeUnsubs.push(unsubSettings);
  }

  FE.connectToFirebase = async function (url) {
    setStatusUI("connecting");
    await FE.firebase.connect(url);
    FE.state.connectedUrl = FE.firebase.getConnectedUrl();
    await startRealtimeSync();
    FE.auth.watchAuthConfig();
    FE.seed.ensureDefaultData();
    const connLabel = document.getElementById("loginConnStatus");
    if (connLabel) connLabel.textContent = "🟢 Đã kết nối Firebase — sẵn sàng đăng nhập";
  };

  // ---------- Presence: hiển thị số thiết bị đang online realtime ----------
  function getDeviceId() {
    let id = localStorage.getItem("fe_device_id");
    if (!id) {
      id = FE.util.uid() + FE.util.uid();
      localStorage.setItem("fe_device_id", id);
    }
    return id;
  }

  function shortDeviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
    if (/Android/.test(ua)) return "Android";
    if (/Macintosh/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    return "Thiết bị";
  }

  async function startPresence(username) {
    const sessionId = getDeviceId();
    await FE.firebase.goOnlinePresence(sessionId, {
      member: username,
      device: shortDeviceLabel(),
    });
    FE.firebase.watchPresence((list) => {
      const bar = document.getElementById("presenceBar");
      const label = document.getElementById("presenceLabel");
      if (!bar || !label) return;
      if (list.length > 0) {
        bar.style.display = "flex";
        label.textContent = `${list.length} thiết bị đang online`;
      } else {
        bar.style.display = "none";
      }
    });
  }

  // ---------- Đăng nhập / đăng xuất ----------
  function enterApp() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    document.getElementById("bottomNav").classList.remove("hidden");
    const session = FE.auth.getSession();
    const nameEl = document.getElementById("navAccountName");
    if (nameEl && session) nameEl.textContent = "👤 " + session.username;
    startPresence(session ? session.username : "admin");
    FE.util.toast("Đăng nhập thành công — dữ liệu đồng bộ realtime", "success");
  }

  function showLoginScreen() {
    document.getElementById("appShell").classList.add("hidden");
    document.getElementById("bottomNav").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
  }

  // ---------- Router / Tabs ----------
  const modules = {}; // name -> { init(container), onUpdate(collection) }

  FE.registerModule = function (name, mod) {
    modules[name] = mod;
  };

  let currentTab = null;

  function showTab(name) {
    currentTab = name;
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".bnav-btn[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("hidden", v.id !== `view-${name}`);
    });
    const mod = modules[name];
    if (mod && mod.render) mod.render();
    if (window.innerWidth < 860) {
      document.getElementById("sideNav").classList.remove("open");
    }
  }
  FE.showTab = showTab;

  document.addEventListener("fe:update", (e) => {
    // Cập nhật module đang hiển thị ngay lập tức; các module khác sẽ tự
    // render lại dữ liệu mới nhất khi được chuyển tới.
    const mod = modules[currentTab];
    if (mod && mod.render) mod.render();
    if (modules.dashboard && modules.dashboard.render) modules.dashboard.render();
    if (modules.notifications && modules.notifications.onData) modules.notifications.onData();
    refreshPendingBadge();
  });

  // ---------- Khởi động ----------
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });
    document.querySelectorAll(".bnav-btn[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });
    document.getElementById("fabAddBtn")?.addEventListener("click", () => {
      if (FE.transactions && FE.transactions.openNew) FE.transactions.openNew();
    });
    document.getElementById("navToggle")?.addEventListener("click", () => {
      document.getElementById("sideNav").classList.toggle("open");
    });

    Object.keys(modules).forEach((name) => {
      const mod = modules[name];
      const container = document.getElementById(`view-${name}`);
      if (mod.init) mod.init(container);
    });

    showTab("dashboard");

    // Tự động kết nối Firebase ngay khi mở trang — dùng Database URL đã cấu
    // hình sẵn trong firebase-config.js, hoặc URL riêng nếu người dùng đã
    // đổi trong ⚙️ Cài đặt trên chính thiết bị này. Không cần thao tác gì.
    const savedUrl = FE.firebase.getSavedUrl();
    if (FIREBASE_AUTO_CONNECT !== false && FE.firebase.isValidDatabaseUrl(savedUrl)) {
      FE.connectToFirebase(savedUrl).catch((err) => {
        const connLabel = document.getElementById("loginConnStatus");
        if (connLabel) connLabel.textContent = "🔴 Chưa kết nối được Firebase — vẫn có thể đăng nhập, sẽ tự đồng bộ khi có mạng.";
        FE.util.toast("Chưa kết nối được Firebase: " + err.message, "error");
      });
    }

    // Nếu đã có phiên đăng nhập lưu trên thiết bị này → vào thẳng ứng dụng.
    if (FE.auth.isLoggedIn()) {
      enterApp();
    } else {
      showLoginScreen();
    }

    document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value;
      const password = document.getElementById("loginPassword").value;
      const remember = document.getElementById("loginRemember").checked;
      const errEl = document.getElementById("loginError");
      const btn = document.getElementById("loginBtn");
      errEl.classList.add("hidden");
      btn.disabled = true;
      btn.textContent = "Đang kiểm tra…";
      try {
        const result = await FE.auth.login(username, password);
        if (result.ok) {
          if (!remember) {
            // Xoá phiên khi đóng tab nếu không chọn "ghi nhớ".
            window.addEventListener("beforeunload", () => FE.auth.logout());
          }
          enterApp();
        } else {
          errEl.textContent = result.message || "Sai tài khoản hoặc mật khẩu.";
          errEl.classList.remove("hidden");
        }
      } catch (err) {
        errEl.textContent = "Lỗi: " + err.message;
        errEl.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Đăng nhập";
      }
    });

    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      const sessionId = localStorage.getItem("fe_device_id");
      if (sessionId) await FE.firebase.clearPresence(sessionId);
      FE.auth.logout();
      showLoginScreen();
      FE.util.toast("Đã đăng xuất", "info");
    });

    window.addEventListener("online", () => FE.util.toast("Đã có kết nối Internet trở lại", "success"));
    window.addEventListener("offline", () => setStatusUI("offline"));
  });
})(window.FE);
