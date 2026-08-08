/* js/dashboard.js */
(function (FE) {
  let container;

  function totalsThisMonth() {
    const month = new Date().toISOString().slice(0, 7);
    let income = 0,
      expense = 0;
    (FE.state.transactions || []).forEach((t) => {
      if (new Date(t.date).toISOString().slice(0, 7) !== month) return;
      if (t.type === "income") income += Number(t.amount);
      else expense += Number(t.amount);
    });
    return { income, expense };
  }

  function totalBalance() {
    return (FE.state.accounts || []).reduce((sum, a) => {
      const base = Number(a.openingBalance) || 0;
      const delta = (FE.state.transactions || [])
        .filter((t) => t.accountId === a.id)
        .reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
      return sum + base + delta;
    }, 0);
  }

  function topCategories() {
    const month = new Date().toISOString().slice(0, 7);
    const byCat = {};
    (FE.state.transactions || []).forEach((t) => {
      if (t.type !== "expense") return;
      if (new Date(t.date).toISOString().slice(0, 7) !== month) return;
      byCat[t.categoryId] = (byCat[t.categoryId] || 0) + Number(t.amount);
    });
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function render() {
    if (!container) return;
    const { income, expense } = totalsThisMonth();
    const balance = totalBalance();
    const top = topCategories();
    const maxTop = Math.max(1, ...top.map(([, v]) => v));
    const recentTx = (FE.state.transactions || []).slice(0, 6);

    container.innerHTML = `
      <div class="view-header"><h2>🏠 Tổng quan</h2></div>
      <div class="stat-grid">
        <div class="stat-card stat-card--balance">
          <div class="stat-card__label">Tổng số dư</div>
          <div class="stat-card__value">${FE.util.formatCurrency(balance)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Thu nhập tháng này</div>
          <div class="stat-card__value amt-in">+${FE.util.formatCurrency(income)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Chi tiêu tháng này</div>
          <div class="stat-card__value amt-out">-${FE.util.formatCurrency(expense)}</div>
        </div>
      </div>

      <div class="dash-cols">
        <div class="panel">
          <h3>Top chi tiêu tháng này</h3>
          ${
            top
              .map(([catId, amount]) => {
                const c = FE.util.byId("categories", catId);
                const pct = Math.round((amount / maxTop) * 100);
                return `
              <div class="bar-row">
                <span class="bar-row__label">${FE.util.escapeHtml(c?.icon || "🏷️")} ${FE.util.escapeHtml(c?.name || "—")}</span>
                <div class="bar-row__track"><div class="bar-row__fill" style="width:${pct}%; background:${c?.color || "#C9A44C"}"></div></div>
                <span class="bar-row__amount">${FE.util.formatCurrency(amount)}</span>
              </div>`;
              })
              .join("") || `<p class="empty">Chưa có dữ liệu chi tiêu.</p>`
          }
        </div>
        <div class="panel">
          <h3>Giao dịch gần đây</h3>
          ${
            recentTx
              .map((t) => {
                const c = FE.util.byId("categories", t.categoryId);
                return `
              <div class="recent-row">
                <span>${FE.util.escapeHtml(c?.icon || "🏷️")} ${FE.util.escapeHtml(c?.name || "—")}</span>
                <span class="recent-row__date">${FE.util.formatDate(t.date)}</span>
                <span class="${t.type === "income" ? "amt-in" : "amt-out"}">${t.type === "income" ? "+" : "-"}${FE.util.formatCurrency(t.amount)}</span>
              </div>`;
              })
              .join("") || `<p class="empty">Chưa có giao dịch.</p>`
          }
        </div>
      </div>
    `;
  }

  function init(el) {
    container = el;
    render();
  }

  FE.registerModule("dashboard", { init, render });
})(window.FE);
