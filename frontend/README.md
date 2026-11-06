# PHIMTNUI Web & Capacitor Frontend

Thư mục frontend độc lập này chứa toàn bộ mã nguồn giao diện người dùng (React 19 + Tailwind CSS) và cấu hình nền tảng Capacitor đóng gói APK cho Android TV & MobiTV.

### Ưu điểm của cấu trúc tách biệt:
1. **Không xung đột dependencies:** Tách rời hoàn toàn các thư viện backend nặng (`@sparticuz/chromium`, `puppeteer-core`, `express`, `cheerio`) khỏi ứng dụng di động.
2. **Build nhanh & nhẹ:** `npm install` trên CI GitHub Actions chỉ cài đặt các gói giao diện cần thiết, giảm thời gian build và bộ nhớ RAM.
3. **Độ ổn định cao:** Gradle và Capacitor compile không bị dính các file rác hoặc native bindings của Node.js backend.

### Cấu trúc thư mục:
- `src/`: Giao diện React (hỗ trợ điều khiển remote D-Pad Android TV và cảm ứng Mobile).
- `public/`: Assets hình ảnh, banner rạp phim và poster.
- `android-setup/`: AndroidManifest.xml chuẩn Leanback cho Android TV Box / Xiaomi TV.
- `capacitor.config.ts`: Cấu hình App ID, Scheme và Web Directory.
- `package.json`: Chỉ gồm React, Tailwind CSS và Capacitor.
