/* js/reports.js */
(function (FE) {
  let container;

  function lastMonths(n) {
    const arr = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < n; i++) {
      arr.unshift(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() - 1);
    }
    return arr;
  }

  function monthlyTotals(months) {
    const map = {};
    months.forEach((m) => (map[m] = { income: 0, expense: 0 }));
    (FE.state.transactions || []).forEach((t) => {
      const m = new Date(t.date).toISOString().slice(0, 7);
      if (!map[m]) return;
      map[m][t.type] += Number(t.amount);
    });
    return map;
  }

  function categoryBreakdown(month) {
    const map = {};
    (FE.state.transactions || []).forEach((t) => {
      if (t.type !== "expense") return;
      if (new Date(t.date).toISOString().slice(0, 7) !== month) return;
      map[t.categoryId] = (map[t.categoryId] || 0) + Number(t.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function render() {
    if (!container) return;
    const months = lastMonths(6);
    const totals = monthlyTotals(months);
    const maxVal = Math.max(1, ...months.flatMap((m) => [totals[m].income, totals[m].expense]));
    const thisMonth = new Date().toISOString().slice(0, 7);
    const breakdown = categoryBreakdown(thisMonth);
    const totalExpense = breakdown.reduce((s, [, v]) => s + v, 0) || 1;

    container.innerHTML = `
      <div class="view-header"><h2>📊 Báo cáo</h2></div>

      <div class="panel">
        <h3>Thu chi 6 tháng gần đây</h3>
        <div class="trend-chart">
          ${months
            .map((m) => {
              const inH = Math.round((totals[m].income / maxVal) * 120);
              const outH = Math.round((totals[m].expense / maxVal) * 120);
              return `
              <div class="trend-col">
                <div class="trend-col__bars">
                  <div class="trend-bar trend-bar--in" style="height:${inH}px" title="Thu: ${FE.util.formatCurrency(totals[m].income)}"></div>
                  <div class="trend-bar trend-bar--out" style="height:${outH}px" title="Chi: ${FE.util.formatCurrency(totals[m].expense)}"></div>
                </div>
                <div class="trend-col__label">${m.slice(5)}/${m.slice(2, 4)}</div>
              </div>`;
            })
            .join("")}
        </div>
        <div class="legend">
          <span><i class="dot dot--in"></i> Thu nhập</span>
          <span><i class="dot dot--out"></i> Chi tiêu</span>
        </div>
      </div>

      <div class="panel">
        <h3>Cơ cấu chi tiêu tháng ${thisMonth}</h3>
        ${
          breakdown
            .map(([catId, amount]) => {
              const c = FE.util.byId("categories", catId);
              const pct = Math.round((amount / totalExpense) * 100);
              return `
            <div class="bar-row">
              <span class="bar-row__label">${FE.util.escapeHtml(c?.icon || "🏷️")} ${FE.util.escapeHtml(c?.name || "—")}</span>
              <div class="bar-row__track"><div class="bar-row__fill" style="width:${pct}%; background:${c?.color || "#C9A44C"}"></div></div>
              <span class="bar-row__amount">${pct}% · ${FE.util.formatCurrency(amount)}</span>
            </div>`;
            })
            .join("") || `<p class="empty">Chưa có chi tiêu trong tháng.</p>`
        }
      </div>
    `;
  }

  function init(el) {
    container = el;
    render();
  }

  FE.registerModule("reports", { init, render });
})(window.FE);
