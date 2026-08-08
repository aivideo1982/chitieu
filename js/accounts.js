/* js/accounts.js */
(function (FE) {
  let container;

  function computeBalance(accId) {
    const acc = FE.util.byId("accounts", accId);
    if (!acc) return 0;
    const base = Number(acc.openingBalance) || 0;
    const delta = (FE.state.transactions || [])
      .filter((t) => t.accountId === accId)
      .reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
    return base + delta;
  }

  function render() {
    if (!container) return;
    const accounts = FE.state.accounts || [];
    container.innerHTML = `
      <div class="view-header">
        <h2>💳 Tài khoản</h2>
        <button class="btn btn--primary" id="acc-add-btn">+ Thêm tài khoản</button>
      </div>
      <div class="card-grid">
        ${accounts
          .map(
            (a) => `
          <div class="card">
            <div class="card__top">
              <span class="card__icon">${FE.util.escapeHtml(a.icon || "💰")}</span>
              <div class="card__actions">
                <button data-edit="${a.id}" class="icon-btn" title="Sửa">✏️</button>
                <button data-del="${a.id}" class="icon-btn" title="Xoá">🗑️</button>
              </div>
            </div>
            <div class="card__title">${FE.util.escapeHtml(a.name)}</div>
            <div class="card__sub">${FE.util.escapeHtml(a.type || "Ví")}</div>
            <div class="card__amount">${FE.util.formatCurrency(computeBalance(a.id))}</div>
          </div>`
          )
          .join("") || `<p class="empty">Chưa có tài khoản nào. Thêm tài khoản để bắt đầu.</p>`}
      </div>
    `;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <form class="modal" id="acc-form">
        <h3>${isEdit ? "Sửa tài khoản" : "Thêm tài khoản"}</h3>
        <label>Tên tài khoản
          <input name="name" required value="${FE.util.escapeHtml(existing?.name || "")}" placeholder="Ví tiền mặt, Vietcombank..." />
        </label>
        <label>Loại
          <select name="type">
            ${["Tiền mặt", "Ngân hàng", "Ví điện tử", "Tiết kiệm"]
              .map((t) => `<option ${existing?.type === t ? "selected" : ""}>${t}</option>`)
              .join("")}
          </select>
        </label>
        <label>Biểu tượng
          <input name="icon" maxlength="2" value="${FE.util.escapeHtml(existing?.icon || "💰")}" />
        </label>
        <label>Số dư ban đầu
          <input name="openingBalance" type="number" step="1000" value="${existing?.openingBalance ?? 0}" />
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="acc-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "Lưu" : "Thêm"}</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#acc-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#acc-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get("name").trim(),
        type: fd.get("type"),
        icon: fd.get("icon") || "💰",
        openingBalance: Number(fd.get("openingBalance")) || 0,
      };
      try {
        if (isEdit) {
          await FE.firebase.updateRecord("accounts", existing.id, data, existing.updatedAt);
        } else {
          await FE.firebase.addRecord("accounts", data);
        }
        FE.util.toast("Đã lưu tài khoản", "success");
        wrap.remove();
      } catch (err) {
        FE.util.toast("Lỗi: " + err.message, "error");
      }
    };
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "acc-add-btn") openForm(null);
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      if (editId) openForm(FE.util.byId("accounts", editId));
      if (delId) {
        if (confirm("Xoá tài khoản này? Các giao dịch liên quan vẫn được giữ lại.")) {
          FE.firebase.removeRecord("accounts", delId).then(() => FE.util.toast("Đã xoá tài khoản"));
        }
      }
    });
    render();
  }

  FE.registerModule("accounts", { init, render });
})(window.FE);
