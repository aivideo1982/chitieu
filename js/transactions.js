/* js/transactions.js */
(function (FE) {
  let container;
  let filters = { type: "all", accountId: "all", categoryId: "all", q: "" };

  function optionsFor(collection, valueField = "id", labelField = "name") {
    return (FE.state[collection] || [])
      .map((r) => `<option value="${r[valueField]}">${FE.util.escapeHtml(r[labelField])}</option>`)
      .join("");
  }

  function label(collection, id, field = "name") {
    const r = FE.util.byId(collection, id);
    return r ? r[field] : "—";
  }

  function filteredList() {
    return (FE.state.transactions || []).filter((t) => {
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
      if (filters.categoryId !== "all" && t.categoryId !== filters.categoryId) return false;
      if (filters.q && !(t.note || "").toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }

  function renderRecurring() {
    const list = FE.state.recurringPayments || [];
    return `
      <div class="section-block">
        <div class="view-header view-header--sub">
          <h3>🔁 Giao dịch định kỳ</h3>
          <button class="btn btn--sm" id="rec-add-btn">+ Thêm định kỳ</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tên</th><th>Số tiền</th><th>Chu kỳ</th><th>Ngày tới</th><th>Tài khoản</th><th></th></tr></thead>
            <tbody>
              ${
                list
                  .map(
                    (r) => `
                <tr>
                  <td>${FE.util.escapeHtml(r.name)}</td>
                  <td class="${r.type === "income" ? "amt-in" : "amt-out"}">${FE.util.formatCurrency(r.amount)}</td>
                  <td>${r.frequency === "monthly" ? "Hàng tháng" : r.frequency === "weekly" ? "Hàng tuần" : "Hàng năm"}</td>
                  <td>${FE.util.formatDate(r.nextDate)}</td>
                  <td>${FE.util.escapeHtml(label("accounts", r.accountId))}</td>
                  <td class="row-actions">
                    <button data-run="${r.id}" class="icon-btn" title="Ghi nhận ngay">▶️</button>
                    <button data-recedit="${r.id}" class="icon-btn" title="Sửa">✏️</button>
                    <button data-recdel="${r.id}" class="icon-btn" title="Xoá">🗑️</button>
                  </td>
                </tr>`
                  )
                  .join("") || `<tr><td colspan="6" class="empty">Chưa có khoản định kỳ.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function render() {
    if (!container) return;
    const list = filteredList();
    container.innerHTML = `
      <div class="view-header">
        <h2>💸 Giao dịch</h2>
        <button class="btn btn--primary" id="tx-add-btn">+ Thêm giao dịch</button>
      </div>
      <div class="filters">
        <select id="f-type">
          <option value="all">Tất cả loại</option>
          <option value="income" ${filters.type === "income" ? "selected" : ""}>Thu nhập</option>
          <option value="expense" ${filters.type === "expense" ? "selected" : ""}>Chi tiêu</option>
        </select>
        <select id="f-account"><option value="all">Tất cả tài khoản</option>${optionsFor("accounts")}</select>
        <select id="f-category"><option value="all">Tất cả danh mục</option>${optionsFor("categories")}</select>
        <input id="f-q" placeholder="Tìm ghi chú..." value="${FE.util.escapeHtml(filters.q)}" />
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Ngày</th><th>Danh mục</th><th>Ghi chú</th><th>Tài khoản</th><th>Thành viên</th><th>Số tiền</th><th></th></tr></thead>
          <tbody>
            ${
              list
                .map(
                  (t) => `
              <tr>
                <td>${FE.util.formatDate(t.date)}</td>
                <td>${FE.util.escapeHtml(label("categories", t.categoryId))}</td>
                <td>${FE.util.escapeHtml(t.note || "")}</td>
                <td>${FE.util.escapeHtml(label("accounts", t.accountId))}</td>
                <td>${FE.util.escapeHtml(label("familyMembers", t.memberId))}</td>
                <td class="${t.type === "income" ? "amt-in" : "amt-out"}">${t.type === "income" ? "+" : "-"}${FE.util.formatCurrency(t.amount)}</td>
                <td class="row-actions">
                  <button data-edit="${t.id}" class="icon-btn" title="Sửa">✏️</button>
                  <button data-del="${t.id}" class="icon-btn" title="Xoá">🗑️</button>
                </td>
              </tr>`
                )
                .join("") || `<tr><td colspan="7" class="empty">Chưa có giao dịch nào.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      ${renderRecurring()}
    `;
  }

  function categoryOptionsFor(type, selectedId) {
    return (FE.state.categories || [])
      .filter((c) => c.type === type)
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${FE.util.escapeHtml(
            (c.icon || "🏷️") + " " + c.name
          )}</option>`
      )
      .join("");
  }

  function txFormHtml(existing) {
    const isEdit = !!existing;
    const dateVal = existing?.date
      ? new Date(existing.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const initialType = existing?.type === "income" ? "income" : "expense";
    return `
      <form class="modal" id="tx-form">
        <h3>${isEdit ? "Sửa giao dịch" : "Thêm giao dịch"}</h3>
        <div class="type-toggle" id="tx-type-toggle">
          <button type="button" class="type-toggle__btn ${initialType === "expense" ? "active" : ""}" data-type="expense">💸 Chi tiêu</button>
          <button type="button" class="type-toggle__btn ${initialType === "income" ? "active" : ""}" data-type="income">💰 Thu nhập</button>
        </div>
        <input type="hidden" name="type" id="tx-type" value="${initialType}" />
        <label>Số tiền
          <input name="amount" type="number" min="1" step="1000" inputmode="numeric" required value="${existing?.amount ?? ""}" placeholder="VD: 250000" />
        </label>
        <label>Ngày
          <input name="date" type="date" required value="${dateVal}" />
        </label>
        <label>Danh mục
          <select name="categoryId" id="tx-category" required>${categoryOptionsFor(initialType, existing?.categoryId)}</select>
        </label>
        <label>Tài khoản
          <select name="accountId" required>${optionsFor("accounts")}</select>
        </label>
        <label>Thành viên
          <select name="memberId"><option value="">—</option>${optionsFor("familyMembers")}</select>
        </label>
        <label>Ghi chú
          <input name="note" value="${FE.util.escapeHtml(existing?.note || "")}" placeholder="VD: Ăn trưa" />
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="tx-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary" id="tx-submit">${isEdit ? "Lưu" : "Lưu giao dịch"}</button>
        </div>
      </form>`;
  }

  function openTxForm(existing) {
    if (!(FE.state.categories || []).length || !(FE.state.accounts || []).length) {
      FE.util.toast("Đang khởi tạo dữ liệu mặc định — vui lòng thử lại sau vài giây", "info");
      FE.seed.ensureDefaultData();
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = txFormHtml(existing);
    document.body.appendChild(wrap);
    if (existing) {
      wrap.querySelector('[name="accountId"]').value = existing.accountId;
      wrap.querySelector('[name="memberId"]').value = existing.memberId || "";
    }

    // Chuyển loại Chi tiêu / Thu nhập → nạp lại danh mục tương ứng.
    wrap.querySelectorAll(".type-toggle__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        wrap.querySelector("#tx-type").value = type;
        wrap.querySelectorAll(".type-toggle__btn").forEach((b) => b.classList.toggle("active", b === btn));
        const catSelect = wrap.querySelector("#tx-category");
        catSelect.innerHTML = categoryOptionsFor(type, null);
      });
    });

    wrap.querySelector("#tx-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#tx-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = wrap.querySelector("#tx-submit");

      const amount = Number(fd.get("amount"));
      const categoryId = fd.get("categoryId");
      const accountId = fd.get("accountId");
      const dateStr = fd.get("date");

      // 1-4. Validate dữ liệu thật trước khi ghi Firebase — không cho gửi
      // dữ liệu rác, và báo lỗi rõ ràng cho từng trường hợp.
      if (!amount || amount <= 0 || Number.isNaN(amount)) {
        FE.util.toast("⚠️ Số tiền phải lớn hơn 0", "error");
        return;
      }
      if (!categoryId) {
        FE.util.toast("⚠️ Vui lòng chọn danh mục", "error");
        return;
      }
      if (!accountId) {
        FE.util.toast("⚠️ Vui lòng chọn tài khoản", "error");
        return;
      }
      if (!dateStr) {
        FE.util.toast("⚠️ Vui lòng chọn ngày", "error");
        return;
      }

      const data = {
        type: fd.get("type") === "income" ? "income" : "expense",
        amount,
        date: new Date(dateStr).getTime(),
        categoryId,
        accountId,
        memberId: fd.get("memberId") || null,
        note: (fd.get("note") || "").trim(),
      };

      // 5. Hiển thị "Đang lưu..." — chờ Firebase xác nhận thật, không giả lập.
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang lưu…";
      try {
        if (existing) {
          const res = await FE.firebase.updateRecord("transactions", existing.id, data, existing.updatedAt);
          if (res.conflict) {
            FE.util.toast("Giao dịch đã được cập nhật bởi thiết bị khác — vui lòng mở lại để sửa bản mới nhất", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Lưu";
            return;
          }
          FE.util.toast("✓ Đã lưu thay đổi", "success");
        } else {
          await FE.firebase.addRecord("transactions", data);
          FE.util.toast("✓ Đã lưu giao dịch thành công", "success");
        }
        // 8-9. Đóng form chỉ sau khi Firebase xác nhận xong.
        wrap.remove();
        // 10-11. Dashboard / danh sách giao dịch sẽ tự cập nhật qua realtime
        // listener (fe:update) — không cần gọi render() thủ công ở đây.
      } catch (err) {
        FE.util.toast("🔴 Lỗi khi lưu vào Firebase: " + err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit_label(existing);
      }
    };

    function isEdit_label(ex) {
      return ex ? "Lưu" : "Lưu giao dịch";
    }
  }

  function recFormHtml(existing) {
    const isEdit = !!existing;
    const dateVal = existing?.nextDate
      ? new Date(existing.nextDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return `
      <form class="modal" id="rec-form">
        <h3>${isEdit ? "Sửa định kỳ" : "Thêm giao dịch định kỳ"}</h3>
        <label>Tên khoản
          <input name="name" required value="${FE.util.escapeHtml(existing?.name || "")}" placeholder="Tiền thuê nhà, Internet..." />
        </label>
        <label>Loại
          <select name="type">
            <option value="expense" ${existing?.type !== "income" ? "selected" : ""}>Chi tiêu</option>
            <option value="income" ${existing?.type === "income" ? "selected" : ""}>Thu nhập</option>
          </select>
        </label>
        <label>Số tiền
          <input name="amount" type="number" min="0" step="1000" required value="${existing?.amount ?? ""}" />
        </label>
        <label>Chu kỳ
          <select name="frequency">
            <option value="weekly" ${existing?.frequency === "weekly" ? "selected" : ""}>Hàng tuần</option>
            <option value="monthly" ${!existing || existing?.frequency === "monthly" ? "selected" : ""}>Hàng tháng</option>
            <option value="yearly" ${existing?.frequency === "yearly" ? "selected" : ""}>Hàng năm</option>
          </select>
        </label>
        <label>Ngày kế tiếp
          <input name="nextDate" type="date" required value="${dateVal}" />
        </label>
        <label>Danh mục
          <select name="categoryId" required>${optionsFor("categories")}</select>
        </label>
        <label>Tài khoản
          <select name="accountId" required>${optionsFor("accounts")}</select>
        </label>
        <div class="modal__actions">
          <button type="button" class="btn" id="rec-cancel">Huỷ</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "Lưu" : "Thêm"}</button>
        </div>
      </form>`;
  }

  function openRecForm(existing) {
    if (!(FE.state.categories || []).length || !(FE.state.accounts || []).length) {
      FE.util.toast("Hãy tạo ít nhất 1 tài khoản và 1 danh mục trước", "error");
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = recFormHtml(existing);
    document.body.appendChild(wrap);
    if (existing) {
      wrap.querySelector('[name="categoryId"]').value = existing.categoryId;
      wrap.querySelector('[name="accountId"]').value = existing.accountId;
    }
    wrap.querySelector("#rec-cancel").onclick = () => wrap.remove();
    wrap.querySelector("#rec-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get("name").trim(),
        type: fd.get("type"),
        amount: Number(fd.get("amount")),
        frequency: fd.get("frequency"),
        nextDate: new Date(fd.get("nextDate")).getTime(),
        categoryId: fd.get("categoryId"),
        accountId: fd.get("accountId"),
      };
      try {
        if (existing) {
          await FE.firebase.updateRecord("recurringPayments", existing.id, data, existing.updatedAt);
        } else {
          await FE.firebase.addRecord("recurringPayments", data);
        }
        FE.util.toast("Đã lưu khoản định kỳ", "success");
        wrap.remove();
      } catch (err) {
        FE.util.toast("Lỗi: " + err.message, "error");
      }
    };
  }

  function advanceDate(ts, frequency) {
    const d = new Date(ts);
    if (frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }

  async function runRecurring(id) {
    const r = FE.util.byId("recurringPayments", id);
    if (!r) return;
    try {
      await FE.firebase.addRecord("transactions", {
        type: r.type,
        amount: r.amount,
        date: Date.now(),
        categoryId: r.categoryId,
        accountId: r.accountId,
        memberId: null,
        note: `Định kỳ: ${r.name}`,
      });
      await FE.firebase.updateRecord(
        "recurringPayments",
        r.id,
        { nextDate: advanceDate(r.nextDate, r.frequency) },
        r.updatedAt
      );
      FE.util.toast(`Đã ghi nhận "${r.name}"`, "success");
    } catch (err) {
      FE.util.toast("Lỗi: " + err.message, "error");
    }
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "tx-add-btn") openTxForm(null);
      if (e.target.id === "rec-add-btn") openRecForm(null);
      const editId = e.target.dataset.edit;
      const delId = e.target.dataset.del;
      const recEdit = e.target.dataset.recedit;
      const recDel = e.target.dataset.recdel;
      const run = e.target.dataset.run;
      if (editId) openTxForm(FE.util.byId("transactions", editId));
      if (delId && confirm("Xoá giao dịch này?")) {
        FE.firebase.removeRecord("transactions", delId).then(() => FE.util.toast("Đã xoá giao dịch"));
      }
      if (recEdit) openRecForm(FE.util.byId("recurringPayments", recEdit));
      if (recDel && confirm("Xoá khoản định kỳ này?")) {
        FE.firebase.removeRecord("recurringPayments", recDel).then(() => FE.util.toast("Đã xoá khoản định kỳ"));
      }
      if (run) runRecurring(run);
    });
    container.addEventListener("change", (e) => {
      if (e.target.id === "f-type") filters.type = e.target.value;
      if (e.target.id === "f-account") filters.accountId = e.target.value;
      if (e.target.id === "f-category") filters.categoryId = e.target.value;
      if (["f-type", "f-account", "f-category"].includes(e.target.id)) render();
    });
    container.addEventListener("input", (e) => {
      if (e.target.id === "f-q") {
        filters.q = e.target.value;
        render();
        document.getElementById("f-q").focus();
        document.getElementById("f-q").selectionStart = document.getElementById("f-q").value.length;
      }
    });
    render();
  }

  FE.registerModule("transactions", { init, render });
  FE.transactions = { openNew: () => openTxForm(null) };
})(window.FE);
