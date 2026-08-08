/* js/backup.js */
(function (FE) {
  let container;

  function render() {
    if (!container) return;
    container.innerHTML = `
      <div class="view-header"><h2>🗄️ Sao lưu &amp; Phục hồi</h2></div>
      <div class="panel">
        <h3>Xuất dữ liệu</h3>
        <p class="muted">Tải toàn bộ dữ liệu hiện tại trên Firebase (giao dịch, tài khoản, danh mục, ngân sách, thành viên, khoản định kỳ) thành một file JSON để lưu trữ.</p>
        <button class="btn btn--primary" id="export-btn">⬇️ Xuất file JSON</button>
      </div>
      <div class="panel">
        <h3>Nhập dữ liệu</h3>
        <p class="muted">Chọn file JSON đã xuất trước đó để <strong>thêm</strong> dữ liệu vào Firebase. Dữ liệu hiện có trên Firebase sẽ không bị xoá — các bản ghi trùng ID sẽ được cập nhật theo thời gian mới nhất.</p>
        <input type="file" id="import-file" accept="application/json" />
        <button class="btn" id="import-btn">⬆️ Nhập dữ liệu</button>
      </div>
    `;
  }

  function doExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      data: {
        transactions: FE.state.transactions,
        accounts: FE.state.accounts,
        categories: FE.state.categories,
        budgets: FE.state.budgets,
        familyMembers: FE.state.familyMembers,
        recurringPayments: FE.state.recurringPayments,
        settings: FE.state.settings,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soquy-giadinh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    FE.util.toast("Đã xuất file sao lưu", "success");
  }

  async function doImport() {
    const fileInput = document.getElementById("import-file");
    const file = fileInput.files[0];
    if (!file) {
      FE.util.toast("Hãy chọn file JSON trước", "error");
      return;
    }
    if (!FE.firebase.isConnected()) {
      FE.util.toast("Chưa kết nối Firebase", "error");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.data || parsed;
      const collections = ["transactions", "accounts", "categories", "budgets", "familyMembers", "recurringPayments"];
      let count = 0;
      for (const col of collections) {
        const list = data[col];
        if (!Array.isArray(list)) continue;
        for (const rec of list) {
          const { id, createdAt, updatedAt, ...fields } = rec;
          if (id && FE.util.byId(col, id)) {
            await FE.firebase.updateRecord(col, id, fields, 0); // 0 => luôn chấp nhận ghi (không rollback bản mới hơn)
          } else {
            await FE.firebase.addRecord(col, fields);
          }
          count++;
        }
      }
      FE.util.toast(`Đã nhập ${count} bản ghi vào Firebase`, "success");
    } catch (err) {
      FE.util.toast("Lỗi khi nhập file: " + err.message, "error");
    }
  }

  function init(el) {
    container = el;
    container.addEventListener("click", (e) => {
      if (e.target.id === "export-btn") doExport();
      if (e.target.id === "import-btn") doImport();
    });
    render();
  }

  FE.registerModule("backup", { init, render });
})(window.FE);
