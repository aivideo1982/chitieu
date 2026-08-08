/* js/budget.js */
(function (FE) {
  let container;
  let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  function spentFor(categoryId, month) {
    return (FE.state.transactions || [])
      .filter((t) => {
        if (t.categoryId !== categoryId || t.type !== "expense") return false;
        const m = new Date(t.date).toISOString().slice(0, 7);
        return m === month;
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  }

  function optionsFor(collection) {
    return (FE.state[collection] || [])
      .filter((c) => (collection === "categories" ? c.type === "expense" : true))
      .map((r) => `<option value="${r.id}">${FE.util.escapeHtml(r.name)}</option>`)
      .join("");
  }

  function label(id) {
    const c = FE.util.byId("categories", id);
    return c ? c.name : "—";
  }

  function render() {
    if (!container) return;
    const budgets = (FE.state.budgets || []).filter((b) => b.month === currentMonth);
    container.innerHTML = `
      <div class="view-header">
        <h2>🎯 Ngân sách</h2>
        <div class="view-header__right">
          <input type="month" id="budget-month" value="${currentMonth}" />
          <button class="btn btn--primary" id="budget-add-btn">+ Thêm ngân sách</button>
        </div>
      </div>
      <div class="card-grid">
        ${
          budgets
            .map((b) => {
              const spent = spentFor(b.categoryId, b.month);
              const pct = b.limit > 0 ? Math.min(100, Math.round((spent / b.limit) * 100)) : 0;
              const over = spent > b.limit;
              return `
              <div class="card budget-card">
                <div class="card__top">
                  <span class="card__icon">🎯</span>
                  <div class="card__actions">
                    <button data-edit="${b.id}" class="icon-btn" title="Sửa">✏️</button>
                    <button data-del="${b.id}" class="icon-btn" title="Xoá">🗑️</button>
                  </div>
                </div>
                <div class="card__title">${FE.util.escapeHtml(label(b.categoryId))}</div>
                <div class="progress">
                  <div class="progress__bar ${over ? "progress__bar--over" : ""}" style="width:${pct}%"></div>
                </div>
                <div class="card__sub">${FE.util.formatCurrency(spent)} / ${FE.util.formatCurrency(b.limit)}
                  ${over ? '<span class="badge badge--warn">Vượt ngân sách</span>' : `<span class="badge">${pct}%</span>`}
                </div>
              </div>`;
            })
            .join("") || `<p class="empty">Chưa có ngân sách cho tháng này.</p>`
        }
      </div>
    `;
  }

  function openForm(existing) {
    if (!(FE.state.categories || []).some((c) => c.type === "expense")) {
      FE.util.toast("Hãy tạo danh mục chi tiêu trước", "error");
      return;
    }
    const isEdit = !!existing;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <form class="modal" id="budget-form">
        <h3>${isEdit ? "Sửa ngân sách" : "Thêm ngân sách"}</h3>
        <label>Danh mục
          <select name="categoryId" required>${optionsFor("categories")}</select>
        </label>
        <label>Tháng
          <input name="month" type="month" required value="${existing?.month || currentMonth}" />
        </label>
        <label>Hạn mức
          <input name="limit" type="number" min="0" step="10000" required value="${existing?.limit ?? ""}" />
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="budget-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "Lưu" : "Thêm"}</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    if (existing) wrap.querySelector('[name="categoryId"]').value = existing.categoryId;
    wrap.querySelector("#budget-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#budget-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        categoryId: fd.get("categoryId"),
        month: fd.get("month"),
        limit: Number(fd.get("limit")),
      };
      try {
        if (isEdit) {
          await FE.firebase.updateRecord("budgets", existing.id, data, existing.updatedAt);
        } else {
          await FE.firebase.addRecord("budgets", data);
        }
        FE.util.toast("Đã lưu ngân sách", "success");
        wrap.remove();
      } catch (err) {
        FE.util.toast("Lỗi: " + err.message, "error");
      }
    };
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "budget-add-btn") openForm(null);
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      if (editId) openForm(FE.util.byId("budgets", editId));
      if (delId && confirm("Xoá ngân sách này?")) {
        FE.firebase.removeRecord("budgets", delId).then(() => FE.util.toast("Đã xoá ngân sách"));
      }
    });
    container.addEventListener("change", (e) => {
      if (e.target.id === "budget-month") {
        currentMonth = e.target.value;
        render();
      }
    });
    render();
  }

  FE.registerModule("budget", { init, render });
})(window.FE);
