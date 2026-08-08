import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soquy.giadinh',
  appName: 'Sổ Quỹ Gia Đình',
  // Chỉ là thư mục "vỏ" tối thiểu để Capacitor CLI build được — KHÔNG phải
  // site thật. Site thật nằm ở repo root, deploy qua GitHub Pages, và app
  // load trực tiếp từ server.url bên dưới. Xem android-shell/index.html.
  webDir: 'android-shell',
  server: {
    // App load trực tiếp trang GitHub Pages này thay vì dùng bản đóng
    // gói sẵn trong APK. Nhờ vậy mỗi lần deploy Pages (push code vào main),
    // mở app lên là thấy bản mới ngay — không cần build/publish lại APK.
    // Chỉ cần build lại APK khi đổi thứ liên quan phần native (tên app,
    // icon, quyền Android...), không phải mỗi khi sửa index.html/css/js.
    url: 'https://aivideo1982.github.io/chitieu/',
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    path: 'android-app',
    allowMixedContent: false
  }
};

export default config;
