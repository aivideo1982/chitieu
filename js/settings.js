/* js/settings.js */
(function (FE) {
  let container;

  function render() {
    if (!container) return;
    const url = FE.firebase.getConnectedUrl() || FE.firebase.getSavedUrl();
    container.innerHTML = `
      <div class="view-header"><h2>⚙️ Cài đặt</h2></div>

      <div class="panel">
        <h3>🔐 Tài khoản đăng nhập</h3>
        <p class="muted">Tài khoản: <b>${FE.util.escapeHtml(FE.auth.getUsername())}</b>. Đổi mật khẩu sẽ đồng bộ ngay tới mọi thiết bị khác qua Firebase.</p>
        <label>Mật khẩu hiện tại
          <input id="settings-old-pass" type="password" autocomplete="current-password" />
        </label>
        <label>Mật khẩu mới
          <input id="settings-new-pass" type="password" autocomplete="new-password" />
        </label>
        <button class="btn btn--primary" id="settings-change-pass-btn">Đổi mật khẩu</button>
      </div>

      <div class="panel">
        <h3>⚙️ Cấu hình Firebase</h3>
        <p class="muted">Firebase đã được cấu hình sẵn và tự động kết nối — không cần thao tác gì. Chỉ đổi mục dưới đây nếu bạn muốn dùng một Firebase Realtime Database riêng của mình.</p>
        <label>Firebase Database URL
          <input id="settings-url" value="${FE.util.escapeHtml(url === FIREBASE_DATABASE_URL ? "" : url)}" placeholder="(đang dùng URL mặc định đã cấu hình sẵn)" />
        </label>
        <button class="btn" id="settings-connect-btn">Đổi Database URL</button>
        <p class="muted" id="settings-status">
          ${FE.firebase.isConnected() ? "🟢 Đang kết nối: " + FE.util.escapeHtml(FE.firebase.getConnectedUrl()) : "🔴 Chưa kết nối"}
        </p>
      </div>

      <div class="panel">
        <h3>Tên gia đình</h3>
        <label>Hiển thị trên ứng dụng
          <input id="settings-family-name" value="${FE.util.escapeHtml(FE.state.settings?.familyName || "")}" placeholder="Gia đình..." />
        </label>
        <button class="btn" id="settings-save-name-btn">Lưu</button>
      </div>

      <div class="panel">
        <h3>Về ứng dụng</h3>
        <p class="muted">Sổ Quỹ Gia Đình — quản lý thu chi đa thiết bị, dữ liệu đồng bộ realtime qua Firebase Realtime Database. Không cần backend riêng, chạy trực tiếp trên GitHub Pages.</p>
        <p class="muted" id="settings-version">Đang tải phiên bản…</p>
      </div>
    `;
    fetch("version.json")
      .then((r) => r.json())
      .then((v) => {
        const el = document.getElementById("settings-version");
        if (el) el.textContent = `Phiên bản ${v.version} (build ${v.build}) — phát hành ${v.releaseDate}`;
      })
      .catch(() => {
        const el = document.getElementById("settings-version");
        if (el) el.textContent = "";
      });
  }

  function init(el) {
    container = el;
    container.addEventListener("click", async (e) => {
      if (e.target.id === "settings-connect-btn") {
        const url = document.getElementById("settings-url").value.trim();
        e.target.disabled = true;
        e.target.textContent = "Đang kết nối…";
        try {
          await FE.connectToFirebase(url || FIREBASE_DATABASE_URL);
          render();
        } catch (err) {
          FE.util.toast(err.message, "error");
        } finally {
          e.target.disabled = false;
          e.target.textContent = "Đổi Database URL";
        }
      }
      if (e.target.id === "settings-save-name-btn") {
        const name = document.getElementById("settings-family-name").value.trim();
        try {
          await FE.firebase.setObject("settings", { familyName: name });
          FE.util.toast("Đã lưu", "success");
        } catch (err) {
          FE.util.toast("Lỗi: " + err.message, "error");
        }
      }
      if (e.target.id === "settings-change-pass-btn") {
        const oldPass = document.getElementById("settings-old-pass").value;
        const newPass = document.getElementById("settings-new-pass").value;
        e.target.disabled = true;
        try {
          const result = await FE.auth.changePassword(oldPass, newPass);
          if (result.ok) {
            FE.util.toast("Đã đổi mật khẩu — áp dụng cho mọi thiết bị", "success");
            render();
          } else {
            FE.util.toast(result.message, "error");
          }
        } catch (err) {
          FE.util.toast("Lỗi: " + err.message, "error");
        } finally {
          e.target.disabled = false;
        }
      }
    });
    render();
  }

  FE.registerModule("settings", { init, render });
})(window.FE);
