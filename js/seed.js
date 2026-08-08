/* js/seed.js
 * NGUYÊN NHÂN GỐC của lỗi "không thêm được giao dịch": form Thêm giao dịch
 * (js/transactions.js openTxForm) yêu cầu phải có sẵn ít nhất 1 tài khoản
 * và 1 danh mục thì mới cho mở form — nhưng trước đây KHÔNG có bước nào tự
 * tạo dữ liệu mặc định, nên trên một Firebase Database mới/rỗng, nút "+"
 * chỉ hiện cảnh báo và không làm gì cả, trông như bị "hỏng".
 *
 * Module này tự kiểm tra (đọc thật từ Firebase bằng .once("value"), không
 * đoán) — nếu collection "accounts" hoặc "categories" rỗng, sẽ tạo dữ liệu
 * mặc định. Chỉ chạy đúng 1 lần cho mỗi collection còn trống, không bao giờ
 * xoá hay ghi đè dữ liệu đã có.
 */

window.FE = window.FE || {};

(function (FE) {
  const DEFAULT_ACCOUNTS = [
    { name: "Tiền mặt", type: "Tiền mặt", icon: "💵", openingBalance: 0 },
    { name: "Ngân hàng", type: "Ngân hàng", icon: "🏦", openingBalance: 0 },
  ];

  const DEFAULT_EXPENSE_CATEGORIES = [
    { name: "Ăn uống", icon: "🍜", color: "#C9A44C" },
    { name: "Đi chợ", icon: "🛒", color: "#4FA88A" },
    { name: "Nhà ở", icon: "🏠", color: "#C1483D" },
    { name: "Điện nước", icon: "💡", color: "#9C7FBF" },
    { name: "Xăng xe", icon: "⛽", color: "#4A90D9" },
    { name: "Mua sắm", icon: "🛍️", color: "#D97A9C" },
    { name: "Y tế", icon: "🏥", color: "#5FB3B3" },
    { name: "Giáo dục", icon: "🎓", color: "#B08968" },
    { name: "Giải trí", icon: "🎮", color: "#E0A458" },
    { name: "Du lịch", icon: "✈️", color: "#6FB1E0" },
    { name: "Khác", icon: "📦", color: "#9CB0A2" },
  ];

  const DEFAULT_INCOME_CATEGORIES = [
    { name: "Lương", icon: "💰", color: "#4FA88A" },
    { name: "Thưởng", icon: "🎁", color: "#C9A44C" },
    { name: "Kinh doanh", icon: "💼", color: "#4A90D9" },
    { name: "Đầu tư", icon: "📈", color: "#5FB3B3" },
    { name: "Thu nhập khác", icon: "📦", color: "#9CB0A2" },
  ];

  let seeding = false;

  async function ensureDefaultData() {
    if (seeding) return;
    if (!FE.firebase.isOnline()) return; // chỉ seed khi chắc chắn đọc được dữ liệu thật từ Firebase
    seeding = true;
    try {
      const [accounts, categories] = await Promise.all([
        FE.firebase.getCollectionOnce("accounts"),
        FE.firebase.getCollectionOnce("categories"),
      ]);
      if (accounts === null || categories === null) return; // chưa kết nối được, không seed để tránh nhầm lẫn

      if (accounts.length === 0) {
        for (const acc of DEFAULT_ACCOUNTS) {
          await FE.firebase.addRecord("accounts", acc);
        }
      }
      if (categories.length === 0) {
        for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
          await FE.firebase.addRecord("categories", { ...cat, type: "expense" });
        }
        for (const cat of DEFAULT_INCOME_CATEGORIES) {
          await FE.firebase.addRecord("categories", { ...cat, type: "income" });
        }
      }
    } catch (e) {
      console.warn("Không thể tự khởi tạo dữ liệu mặc định:", e.message);
    } finally {
      seeding = false;
    }
  }

  FE.seed = { ensureDefaultData };
})(window.FE);
