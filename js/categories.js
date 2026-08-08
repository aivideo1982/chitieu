/* js/categories.js */
(function (FE) {
  let container;

  function render() {
    if (!container) return;
    const cats = FE.state.categories || [];
    const expense = cats.filter((c) => c.type === "expense");
    const income = cats.filter((c) => c.type === "income");

    const renderGroup = (title, list) => `
      <div class="cat-group">
        <h3>${title}</h3>
        <div class="chip-list">
          ${
            list
              .map(
                (c) => `
            <div class="chip" style="--chip-color:${c.color || "#C9A44C"}">
              <span>${FE.util.escapeHtml(c.icon || "🏷️")} ${FE.util.escapeHtml(c.name)}</span>
              <button data-edit="${c.id}" class="chip__btn" title="Sửa">✏️</button>
              <button data-del="${c.id}" class="chip__btn" title="Xoá">×</button>
            </div>`
              )
              .join("") || `<p class="empty">Chưa có danh mục.</p>`
          }
        </div>
      </div>`;

    container.innerHTML = `
      <div class="view-header">
        <h2>🏷️ Danh mục</h2>
        <button class="btn btn--primary" id="cat-add-btn">+ Thêm danh mục</button>
      </div>
      ${renderGroup("Chi tiêu", expense)}
      ${renderGroup("Thu nhập", income)}
    `;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <form class="modal" id="cat-form">
        <h3>${isEdit ? "Sửa danh mục" : "Thêm danh mục"}</h3>
        <label>Tên danh mục
          <input name="name" required value="${FE.util.escapeHtml(existing?.name || "")}" placeholder="Ăn uống, Lương..." />
        </label>
        <label>Loại
          <select name="type">
            <option value="expense" ${existing?.type === "expense" ? "selected" : ""}>Chi tiêu</option>
            <option value="income" ${existing?.type === "income" ? "selected" : ""}>Thu nhập</option>
          </select>
        </label>
        <label>Biểu tượng
          <input name="icon" maxlength="2" value="${FE.util.escapeHtml(existing?.icon || "🏷️")}" />
        </label>
        <label>Màu sắc
          <input name="color" type="color" value="${existing?.color || "#C9A44C"}" />
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="cat-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "Lưu" : "Thêm"}</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#cat-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#cat-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get("name").trim(),
        type: fd.get("type"),
        icon: fd.get("icon") || "🏷️",
        color: fd.get("color"),
      };
      try {
        if (isEdit) {
          await FE.firebase.updateRecord("categories", existing.id, data, existing.updatedAt);
        } else {
          await FE.firebase.addRecord("categories", data);
        }
        FE.util.toast("Đã lưu danh mục", "success");
        wrap.remove();
      } catch (err) {
        FE.util.toast("Lỗi: " + err.message, "error");
      }
    };
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "cat-add-btn") openForm(null);
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      if (editId) openForm(FE.util.byId("categories", editId));
      if (delId) {
        if (confirm("Xoá danh mục này?")) {
          FE.firebase.removeRecord("categories", delId).then(() => FE.util.toast("Đã xoá danh mục"));
        }
      }
    });
    render();
  }

  FE.registerModule("categories", { init, render });
})(window.FE);
