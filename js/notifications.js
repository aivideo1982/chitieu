/* js/notifications.js */
(function (FE) {
  let container;
  let permissionAsked = false;

  function spentFor(categoryId, month) {
    return (FE.state.transactions || [])
      .filter((t) => t.categoryId === categoryId && t.type === "expense" && new Date(t.date).toISOString().slice(0, 7) === month)
      .reduce((s, t) => s + Number(t.amount), 0);
  }

  function buildAlerts() {
    const alerts = [];
    const month = new Date().toISOString().slice(0, 7);

    (FE.state.budgets || [])
      .filter((b) => b.month === month)
      .forEach((b) => {
        const spent = spentFor(b.categoryId, month);
        const cat = FE.util.byId("categories", b.categoryId);
        if (b.limit > 0 && spent >= b.limit) {
          alerts.push({
            kind: "over",
            text: `Vượt ngân sách "${cat?.name || "?"}" (${FE.util.formatCurrency(spent)} / ${FE.util.formatCurrency(b.limit)})`,
          });
        } else if (b.limit > 0 && spent >= b.limit * 0.8) {
          alerts.push({
            kind: "warn",
            text: `Sắp chạm ngân sách "${cat?.name || "?"}" (${Math.round((spent / b.limit) * 100)}%)`,
          });
        }
      });

    const now = Date.now();
    const soon = now + 3 * 24 * 60 * 60 * 1000;
    (FE.state.recurringPayments || []).forEach((r) => {
      if (r.nextDate <= soon) {
        const overdue = r.nextDate < now;
        alerts.push({
          kind: overdue ? "over" : "warn",
          text: `${overdue ? "Đã quá hạn" : "Sắp đến hạn"}: "${r.name}" (${FE.util.formatCurrency(r.amount)}) — ${FE.util.formatDate(r.nextDate)}`,
        });
      }
    });

    return alerts;
  }

  function maybeNotifyBrowser(alerts) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const key = "fe_last_notified_count";
    const prev = Number(sessionStorage.getItem(key) || 0);
    if (alerts.length > prev) {
      new Notification("Sổ Quỹ Gia Đình", {
        body: alerts[0]?.text || "Có cảnh báo mới",
        tag: "fe-alert",
      });
    }
    sessionStorage.setItem(key, String(alerts.length));
  }

  function render() {
    if (!container) return;
    const alerts = buildAlerts();
    maybeNotifyBrowser(alerts);
    container.innerHTML = `
      <div class="view-header">
        <h2>🔔 Thông báo</h2>
        <button class="btn" id="notif-permission-btn">Bật thông báo trình duyệt</button>
      </div>
      <div class="alert-list">
        ${
          alerts
            .map(
              (a) => `<div class="alert alert--${a.kind}">${a.kind === "over" ? "🔴" : "🟠"} ${FE.util.escapeHtml(a.text)}</div>`
            )
            .join("") || `<p class="empty">Không có cảnh báo nào. Mọi thứ đều ổn 👍</p>`
        }
      </div>
    `;
  }

  function onData() {
    if (container && !container.classList.contains("hidden")) render();
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "notif-permission-btn") {
        if (!("Notification" in window)) {
          FE.util.toast("Trình duyệt không hỗ trợ thông báo", "error");
          return;
        }
        Notification.requestPermission().then((perm) => {
          FE.util.toast(perm === "granted" ? "Đã bật thông báo" : "Chưa được cấp quyền thông báo");
        });
      }
    });
    render();
  }

  FE.registerModule("notifications", { init, render, onData });
})(window.FE);
