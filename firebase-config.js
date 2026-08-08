// firebase-config.js
// Cấu hình Firebase đã được thiết lập sẵn — KHÔNG cần nhập tay khi chạy app.
// App sẽ tự động kết nối tới Database URL này ngay khi mở trang.
// Vẫn có thể đổi sang một Database URL khác trong "⚙️ Cài đặt" nếu muốn
// dùng một Firebase project riêng (URL nhập tay sẽ được ưu tiên và lưu lại
// trong localStorage của thiết bị đó).

const FIREBASE_DATABASE_URL =
  "https://chitieu-7c4e8-default-rtdb.asia-southeast1.firebasedatabase.app";

// Gốc dữ liệu dùng chung cho mọi thiết bị kết nối cùng Database URL.
const FIREBASE_ROOT_PATH = "familyExpense";

// Tự động kết nối ngay khi mở app (không cần bấm nút / nhập URL thủ công).
const FIREBASE_AUTO_CONNECT = true;
