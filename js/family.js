/* js/family.js */
(function (FE) {
  let container;

  function memberSpent(memberId) {
    return (FE.state.transactions || [])
      .filter((t) => t.memberId === memberId && t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
  }

  function render() {
    if (!container) return;
    const members = FE.state.familyMembers || [];
    container.innerHTML = `
      <div class="view-header">
        <h2>👨‍👩‍👧‍👦 Thành viên gia đình</h2>
        <button class="btn btn--primary" id="fam-add-btn">+ Thêm thành viên</button>
      </div>
      <div class="card-grid">
        ${
          members
            .map(
              (m) => `
          <div class="card">
            <div class="card__top">
              <span class="avatar" style="background:${m.color || "#C9A44C"}">${FE.util.escapeHtml(
                (m.name || "?").trim()[0] || "?"
              )}</span>
              <div class="card__actions">
                <button data-edit="${m.id}" class="icon-btn" title="Sửa">✏️</button>
                <button data-del="${m.id}" class="icon-btn" title="Xoá">🗑️</button>
              </div>
            </div>
            <div class="card__title">${FE.util.escapeHtml(m.name)}</div>
            <div class="card__sub">${FE.util.escapeHtml(m.role || "Thành viên")}</div>
            <div class="card__amount">Đã chi: ${FE.util.formatCurrency(memberSpent(m.id))}</div>
          </div>`
            )
            .join("") || `<p class="empty">Chưa có thành viên nào.</p>`
        }
      </div>
    `;
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <form class="modal" id="fam-form">
        <h3>${isEdit ? "Sửa thành viên" : "Thêm thành viên"}</h3>
        <label>Tên
          <input name="name" required value="${FE.util.escapeHtml(existing?.name || "")}" />
        </label>
        <label>Vai trò
          <input name="role" value="${FE.util.escapeHtml(existing?.role || "")}" placeholder="Bố, Mẹ, Con..." />
        </label>
        <label>Màu đại diện
          <input name="color" type="color" value="${existing?.color || "#C9A44C"}" />
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="fam-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "Lưu" : "Thêm"}</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#fam-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#fam-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get("name").trim(),
        role: fd.get("role").trim(),
        color: fd.get("color"),
      };
      try {
        if (isEdit) {
          await FE.firebase.updateRecord("familyMembers", existing.id, data, existing.updatedAt);
        } else {
          await FE.firebase.addRecord("familyMembers", data);
        }
        FE.util.toast("Đã lưu thành viên", "success");
        wrap.remove();
      } catch (err) {
        FE.util.toast("Lỗi: " + err.message, "error");
      }
    };
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "fam-add-btn") openForm(null);
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      if (editId) openForm(FE.util.byId("familyMembers", editId));
      if (delId) {
        if (confirm("Xoá thành viên này?")) {
          FE.firebase.removeRecord("familyMembers", delId).then(() => FE.util.toast("Đã xoá thành viên"));
        }
      }
    });
    render();
  }

  FE.registerModule("family", { init, render });
})(window.FE);
