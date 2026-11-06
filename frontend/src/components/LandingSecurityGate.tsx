import React, { useState } from 'react';
import {
  getUniversalApkDownloadUrl,
  resolveBackendUrl,
  saveStoredPreviewJwt,
  verifyPasswordAndGenerateLocalJwt,
} from '../utils/previewAuth';
import { BrandLogo } from './BrandLogo';

interface LandingSecurityGateProps {
  onAuthenticated: (token: string) => void;
  onShowToast: (msg: string) => void;
}

interface GalleryItem {
  id: string;
  title: string;
  desc: string;
  url: string;
  tag: string;
}

export const LandingSecurityGate: React.FC<LandingSecurityGateProps> = ({
  onAuthenticated,
  onShowToast,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Gallery and FAQ states
  const [galleryTab, setGalleryTab] = useState<'tv' | 'mobile'>('tv');
  const [activeLightbox, setActiveLightbox] = useState<GalleryItem | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const apkMobileDownloadUrl = getUniversalApkDownloadUrl('PHIMTNUI-MobiTV.apk');
  const apkTvDownloadUrl = getUniversalApkDownloadUrl('PHIMTNUI-AndroidTV.apk');
  const fullMobileUrl = apkMobileDownloadUrl;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    fullMobileUrl
  )}`;

  // Gallery items for Android TV & MobiTV (inspired by Rapnha structure, tailored for PHIMTNUI)
  const tvGallery: GalleryItem[] = [
    {
      id: 'tv-top-10',
      title: 'Top 10 Phim Cập Nhật',
      desc: 'Bảng xếp hạng phim xu hướng với chữ số lớn cách điệu, lướt 4 chiều mượt mà.',
      url: 'https://rapnha.github.io/img/tv-03-top-10.jpg',
      tag: 'BẢNG XẾP HẠNG TV',
    },
    {
      id: 'tv-home',
      title: 'Trang Chủ Android TV Leanback',
      desc: 'Hero banner điện ảnh đổi nền tự động, phân loại Truyền hình, Phim lẻ, Phim bộ trực quan.',
      url: 'https://rapnha.github.io/img/tv-02-trang-chu.jpg',
      tag: 'TRANG CHỦ TV',
    },
    {
      id: 'tv-detail',
      title: 'Chi Tiết Phim & Chọn Tập',
      desc: 'Hiển thị đầy đủ thông tin, diễn viên, tóm tắt và danh sách tập phim kèm server phát.',
      url: 'https://rapnha.github.io/img/tv-04-chi-tiet-phim.jpg',
      tag: 'CHI TIẾT PHIM',
    },
    {
      id: 'tv-player',
      title: 'Trình Phát Video Toàn Màn Hình Remote',
      desc: 'Điều khiển Play/Pause, tua 10s, chọn tập và đổi luồng máy chủ bằng phím D-Pad.',
      url: 'https://rapnha.github.io/img/tv-06-trinh-phat.jpg',
      tag: 'TRÌNH PHÁT TV',
    },
    {
      id: 'tv-search',
      title: 'Tìm Kiếm Tiếng Việt Bằng Remote',
      desc: 'Bàn phím ảo thông minh tối ưu cho remote TV, hỗ trợ tìm kiếm có dấu hoặc không dấu.',
      url: 'https://rapnha.github.io/img/tv-08-tim-kiem.jpg',
      tag: 'TÌM KIẾM TV',
    },
  ];

  const mobileGallery: GalleryItem[] = [
    {
      id: 'm-detail',
      title: 'Chi Tiết Phim Thượng Công Chúa',
      desc: 'Giao diện dọc hiện đại, nút xem tiếp tập đang dừng, dàn diễn viên và tóm tắt nội dung.',
      url: 'https://rapnha.github.io/img/m-03-chi-tiet-phim.jpg',
      tag: 'CHI TIẾT PHIM',
    },
    {
      id: 'm-home',
      title: 'Trang Chủ Vuốt Chạm 120Hz',
      desc: 'Tối ưu cho Samsung Galaxy S24 & máy tính bảng, cuộn vô tận mượt mà các hàng phim.',
      url: 'https://rapnha.github.io/img/m-02-trang-chu.jpg',
      tag: 'TRANG CHỦ MOBI',
    },
    {
      id: 'm-player',
      title: 'Trình Phát Toàn Màn Hình Cử Chỉ',
      desc: 'Cử chỉ vuốt tăng giảm độ sáng, âm lượng bên viền, khóa màn hình chống chạm nhầm.',
      url: 'https://rapnha.github.io/img/m-05-trinh-phat.jpg',
      tag: 'TRÌNH PHÁT MOBI',
    },
    {
      id: 'm-episodes',
      title: 'Danh Sách Tập Dạng Bottom Sheet',
      desc: 'Bảng chọn tập vuốt từ dưới lên nhẹ nhàng, chọn tập nhanh không làm ngắt quãng phim.',
      url: 'https://rapnha.github.io/img/m-04-danh-sach-tap.jpg',
      tag: 'DANH SÁCH TẬP',
    },
    {
      id: 'm-search',
      title: 'Tìm Kiếm & Bộ Lọc Đa Chiều',
      desc: 'Lọc tức thì theo quốc gia, thể loại, năm phát hành kèm gợi ý kết quả tức thì.',
      url: 'https://rapnha.github.io/img/m-08-tim-kiem.jpg',
      tag: 'TÌM KIẾM MOBI',
    },
  ];

  // Features list
  const features = [
    {
      icon: '🎮',
      title: '100% Chuẩn Remote D-Pad',
      desc: 'Điều hướng 4 phím mũi tên, chọn bằng OK. Viền sáng tiêu điểm to rõ, nhìn đẹp từ sofa cách 3 mét.',
    },
    {
      icon: '📱',
      title: 'Mượt mà màn hình 120Hz',
      desc: 'Tối ưu cử chỉ vuốt chạm cho Samsung Galaxy S24, cuộn danh sách phim phản hồi tức thì.',
    },
    {
      icon: '⚡',
      title: 'Phát Luồng HLS/DASH Tốc Độ Cao',
      desc: 'Trình phát Shaka Player & ExoPlayer tự động chuyển đổi server dự phòng khi mạng chập chờn.',
    },
    {
      icon: '🛡️',
      title: 'Bảo Vệ Anti-Bot JWT',
      desc: 'Hệ thống xác thực mã hóa bảo vệ tài nguyên luồng phát, loại bỏ bot và crawler quét tự động.',
    },
    {
      icon: '⏱️',
      title: 'Xem Tiếp Đúng Giây Dừng',
      desc: 'Tắt app giữa chừng? Lần sau mở lên phim chờ sẵn với đúng giây bạn đã tạm dừng trước đó.',
    },
    {
      icon: '🔍',
      title: 'Tìm Kiếm Tiếng Việt Thông Minh',
      desc: 'Gõ có dấu hay không dấu đều chính xác. Lọc nhanh theo thể loại, quốc gia và năm phát hành.',
    },
    {
      icon: '🚫',
      title: 'Không Chèn Quảng Cáo (No Ads)',
      desc: 'PHIMTNUI không chèn bất kỳ banner hay pop-up quảng cáo nào, trải nghiệm điện ảnh thuần khiết.',
    },
    {
      icon: '🔄',
      title: 'Tự Động Cập Nhật Qua GitHub',
      desc: 'Mỗi khi có bản nâng cấp mới, ứng dụng tự động thông báo và tải đè bản mới chỉ bằng một chạm.',
    },
  ];

  // FAQs
  const faqs = [
    {
      q: 'PHIMTNUI có mất phí hay bắt nạp tiền không?',
      a: 'Không. PHIMTNUI là dự án mã nguồn mở hoàn toàn miễn phí, không có gói dịch vụ trả phí, không thu tiền và không yêu cầu đăng ký thông tin cá nhân.',
    },
    {
      q: 'Ứng dụng có an toàn không? Tại sao khi cài máy báo "nguồn không xác định"?',
      a: 'Hệ điều hành Android luôn hiển thị cảnh báo này khi bạn cài đặt file APK ngoài Google Play Store. Ứng dụng PHIMTNUI an toàn 100%, được công khai mã nguồn trên GitHub kèm mã băm kiểm tra SHA-256 đối chiếu.',
    },
    {
      q: 'Những thiết bị nào sử dụng tốt nhất?',
      a: 'Ứng dụng phát hành 2 bản riêng biệt: Bản Android TV tối ưu cho Xiaomi TV, Sony, TCL, Google TV và Android Box; Bản MobiTV tối ưu cho Samsung Galaxy S24, tablet và các máy chạy Android 7.0 trở lên.',
    },
    {
      q: 'Cơ chế tự cập nhật hoạt động như thế nào?',
      a: 'Mỗi khi khởi động, ứng dụng tự đối chiếu phiên bản hiện tại với GitHub Releases. Nếu có bản mới (ví dụ v1.3.1), bạn chỉ cần nhấn "Cập nhật ngay" để tải và nâng cấp mà không mất dữ liệu lịch sử xem.',
    },
    {
      q: 'Mật khẩu bảo mật dùng để làm gì?',
      a: 'Mật khẩu là cơ chế cổng bảo mật Anti-Bot JWT để hạn chế việc bot tự động quét quá tải máy chủ phát luồng, đảm bảo đường truyền luôn thông suốt cho người dùng thực thụ.',
    },
    {
      q: 'Làm thế nào để cài đặt trên Smart TV Xiaomi / Android Box?',
      a: 'Bạn chỉ cần cài ứng dụng Downloader từ CH Play trên TV, nhập địa chỉ GitHub tải file APK Android TV của PHIMTNUI và nhấn Cài đặt trong vòng 2 phút.',
    },
  ];

  const executeLoginWithPassword = async (pwdToVerify: string) => {
    const trimmed = pwdToVerify.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập mật khẩu truy cập (ví dụ: Q@z123456 hoặc 1991).');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // 1. Instant local cryptographic verification (works 100% offline/APK/GitHub Pages)
      const localResult = await verifyPasswordAndGenerateLocalJwt(trimmed);
      if (localResult.success && localResult.token) {
        saveStoredPreviewJwt(localResult.token, localResult.exp);
        onShowToast('🔓 Xác thực thành công! Đang mở PHIM.TNUI 2026...');
        setTimeout(() => {
          onAuthenticated(localResult.token!);
        }, 150);
        return;
      }

      // 2. Fallback to Cloud Backend verification
      const res = await fetch(resolveBackendUrl('/api/auth/preview-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success || !data?.token) {
        setErrorMsg(
          data?.error || '❌ Mật khẩu không chính xác! Gợi ý: Q@z123456 hoặc 1991'
        );
        return;
      }

      saveStoredPreviewJwt(data.token, data.exp);
      onShowToast('🔓 Xác thực Anti-Bot JWT thành công! Đang chuyển vào PHIM.TNUI...');
      setTimeout(() => {
        onAuthenticated(data.token);
      }, 200);
    } catch {
      const fallback = await verifyPasswordAndGenerateLocalJwt(trimmed);
      if (fallback.success && fallback.token) {
        saveStoredPreviewJwt(fallback.token, fallback.exp);
        onShowToast('🔓 Xác thực thành công! Đang mở PHIM.TNUI...');
        onAuthenticated(fallback.token);
        return;
      }
      setErrorMsg('❌ Mật khẩu không chính xác! Vui lòng nhập Q@z123456 hoặc 1991.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await executeLoginWithPassword(password);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#05070e] text-white font-sans antialiased selection:bg-amber-500 selection:text-black">
      {/* =====================================================================
          CINEMATIC THEATER BACKGROUND (BRIGHT LUXURY CINEMA WITH WARM AMBIENT GLOW)
         ===================================================================== */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Luxury Cinema Seats Wallpaper - Visible, elegant and warm */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-55 scale-105 filter blur-[2px] transition-opacity duration-1000"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=85&w=2070&auto=format&fit=crop')",
          }}
        />

        {/* Golden Theater Projector Beam Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-amber-400/25 via-amber-600/15 to-transparent rounded-full blur-[110px]" />

        {/* Velvet Crimson Auditorium Floor Reflection */}
        <div className="absolute bottom-0 inset-x-0 h-[450px] bg-gradient-to-t from-red-900/30 via-red-950/20 to-transparent blur-[80px]" />

        {/* Soft atmospheric cinema wash (balanced: not too dark, rich contrast) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060913]/60 via-[#080d1a]/50 to-[#060913]/85" />
      </div>

      <div className="relative z-10">
        {/* =====================================================================
            1. NAVIGATION BAR (BRAND: PHIM.TNUI)
           ===================================================================== */}
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#05070e]/90 border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            {/* Brand Logo PHIM.TNUI */}
            <div
              className="cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <BrandLogo
                size="md"
                subtitle="4K CINEMA & LIVE TV 2026"
                badgeText="v3.0"
              />
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-300">
              <button
                type="button"
                onClick={() => scrollToSection('devices')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Nền tảng
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Tính năng
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('gallery')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Hình ảnh
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('download')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Cài đặt
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Hỏi đáp
              </button>
            </nav>

            {/* Action CTA */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => scrollToSection('download')}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all transform hover:scale-105 cursor-pointer flex items-center gap-1.5"
              >
                <span>⬇</span>
                <span>Tải APK v3.0</span>
              </button>
            </div>
          </div>
        </header>

        {/* =====================================================================
            2. HERO SECTION & CENTRAL AUTHENTICATION CARD
           ===================================================================== */}
        <section className="relative pt-10 sm:pt-16 pb-14 sm:pb-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            {/* DIRECT 1-CLICK APK DOWNLOAD BAR right at top */}
            <div className="max-w-xl mx-auto rounded-2xl bg-[#0d1424]/90 border border-amber-400/40 p-4 sm:p-5 backdrop-blur-xl shadow-2xl space-y-3">
              <div className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide flex items-center justify-center gap-2">
                <span>✨</span>
                <span>BẢN CẬP NHẬT v3.0 (2026) — ĐÃ FIX LỖI CÀI ĐẶT &amp; CÓ LOGO RIÊNG</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={apkMobileDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="PHIMTNUI-MobiTV.apk"
                  className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  <span>📱</span>
                  <span>Tải APK Điện Thoại (MobiTV v3.0)</span>
                </a>
                <a
                  href={apkTvDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="PHIMTNUI-AndroidTV.apk"
                  className="px-4 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  <span>📺</span>
                  <span>Tải APK Smart TV (Android TV v3.0)</span>
                </a>
              </div>
            </div>

            {/* CENTRAL PASSWORD INPUT & ENTRY BUTTON */}
            <div className="relative max-w-xl mx-auto rounded-3xl bg-[#0a0f1d]/90 border border-amber-500/40 shadow-[0_15px_50px_rgba(245,158,11,0.22)] p-6 sm:p-8 backdrop-blur-2xl space-y-5 overflow-hidden">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative flex flex-col items-center gap-2 text-center">
                <BrandLogo variant="icon" size="lg" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                  Cổng Truy Cập PHIM.TNUI 2026
                </h1>
                <p className="text-xs text-zinc-400">
                  Nhập mật khẩu <code className="text-amber-300 font-bold">Q@z123456</code> hoặc mã PIN nhanh <code className="text-amber-300 font-bold">1991</code>
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                    <span className="text-lg">🔒</span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg('');
                    }}
                    disabled={isVerifying}
                    placeholder="Nhập Q@z123456 hoặc 1991..."
                    autoComplete="current-password"
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#080c17] border border-white/15 hover:border-amber-500/50 focus:border-amber-500 text-white placeholder-zinc-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/25 transition-all shadow-inner"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Hiện/Ẩn mật khẩu"
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-black font-black text-sm sm:text-base transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isVerifying ? '⏳ Đang xác thực...' : '▶ Vào Xem Phim Ngay'}</span>
                </button>

                {/* 1-Click Remote TV Login Button */}
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => executeLoginWithPassword('1991')}
                  className="w-full py-3 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 focus:ring-4 focus:ring-amber-400 text-amber-300 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📺</span>
                  <span>Vào Nhanh 1-Chạm (Dành Cho Remote Android TV)</span>
                </button>
              </form>

              <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400 border-t border-white/10">
                <span className="text-emerald-400 font-semibold">
                  Bảo vệ Anti-Bot JWT v3.0
                </span>
                <span className="text-zinc-500 font-medium">
                  Tương thích Android TV &amp; MobiTV 120Hz
                </span>
              </div>
            </div>

            {/* Slogan Description */}
            <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed drop-shadow">
              PHIMTNUI 2 bản TV và điện thoại đa giao diện cho người dùng — điều khiển mượt mà bằng remote trên Android TV và trải nghiệm vuốt chạm đỉnh cao trên MobiTV.
            </p>
          </div>
        </section>

        {/* =====================================================================
            3. TWO DEVICE SHOWCASE CARDS (NỀN TẢNG: ANDROID TV & MOBITV)
           ===================================================================== */}
        <section id="devices" className="py-8 sm:py-14 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* ===============================================================
                CARD 1: ANDROID TV & TV BOX (TOP 10 INTERFACE)
               =============================================================== */}
            <div className="rounded-3xl bg-[#0b101c]/95 border border-white/10 hover:border-amber-500/50 p-5 sm:p-7 flex flex-col justify-between space-y-5 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 backdrop-blur-xl group">
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#050811] border border-white/15 shadow-2xl flex flex-col justify-between select-none">
                {/* Real Android TV Screenshot from Rapnha repository */}
                <img
                  src="https://rapnha.github.io/img/tv-03-top-10.jpg"
                  alt="Giao diện Android TV PHIMTNUI"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                  loading="lazy"
                />

                {/* Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050811]/90 via-transparent to-[#050811]/40 pointer-events-none" />

                {/* Watermark Brand PHIMTNUI Overlay */}
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-amber-500/40 shadow-lg">
                    <span className="w-4 h-4 rounded bg-amber-500 text-black font-black flex items-center justify-center text-[10px]">
                      P
                    </span>
                    <span className="font-black text-xs tracking-tight text-white">PHIMTNUI TV</span>
                  </div>
                  <div className="px-2.5 py-0.5 rounded bg-red-600/95 text-white font-black text-[8px] tracking-wider uppercase shadow-md">
                    SMART TV · D-PAD REMOTE
                  </div>
                </div>

                <div className="relative z-10 p-3 flex items-center justify-between text-[9px] text-zinc-300 bg-black/70 backdrop-blur-sm border-t border-white/10">
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span>◄ ►</span>
                    <span>Lướt hàng phim</span>
                  </span>
                  <span className="font-semibold text-white">Bấm OK để phát ngay</span>
                </div>
              </div>

              {/* Text Description */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <span>ANDROID TV &amp; TV BOX</span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-[10px]">
                    Xiaomi TV · Mi Box · Google TV
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Thiết kế cho chiếc remote
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Lướt bằng 4 phím mũi tên, chọn bằng OK. Đầy đủ danh mục Truyền Hình, Phim Lẻ, Phim Bộ
                  và phim Chiếu Rạp. Chữ to, rõ, nhìn đẹp từ sofa cách 3 mét.
                </p>
              </div>
            </div>

            {/* ===============================================================
                CARD 2: PHONE & TABLET (MOBITV INTERFACE)
               =============================================================== */}
            <div className="rounded-3xl bg-[#0b101c]/95 border border-white/10 hover:border-amber-500/50 p-5 sm:p-7 flex flex-col justify-between space-y-5 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 backdrop-blur-xl group">
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden bg-[#070a12] border border-white/15 shadow-2xl flex items-center justify-center p-3 select-none">
                {/* Real Mobile Screenshot inside Smartphone frame */}
                <div className="relative h-full aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                  <img
                    src="https://rapnha.github.io/img/m-03-chi-tiet-phim.jpg"
                    alt="Giao diện MobiTV PHIMTNUI"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  {/* Smartphone camera notch */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-black/90 border border-white/15" />
                </div>

                {/* Top Badge */}
                <div className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded bg-amber-500 text-black font-black text-[8px] tracking-wider uppercase shadow">
                  SAMSUNG S24 · 120HZ
                </div>

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-[9px] text-zinc-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Trải nghiệm vuốt chạm thuần túy</span>
                </div>
              </div>

              {/* Text Description */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <span>ĐIỆN THOẠI &amp; MÁY TÍNH BẢNG</span>
                  <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-[10px]">
                    Samsung Galaxy S24 · Android
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Rạp phim bỏ túi
                </h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Trình phát toàn màn hình với cử chỉ vuốt chạm quen thuộc như Netflix. Hỗ trợ mượt mà
                  màn hình tần số quét 120Hz của Samsung S24 và máy tính bảng.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            4. TÍNH NĂNG VƯỢT TRỘI (FEATURE GRID - INSPIRED BY RAPNHA)
           ===================================================================== */}
        <section id="features" className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-10 sm:space-y-12">
            <div className="text-center space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                TÍNH NĂNG NỔI BẬT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Mọi thứ bạn cần cho một buổi tối xem phim
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto">
                Tối ưu độc lập cho trải nghiệm ngồi xem từ sofa phòng khách lẫn di động trên tay
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {features.map((feat, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#0b101c]/90 border border-white/10 hover:border-amber-500/40 p-5 space-y-3 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 backdrop-blur-xl"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner">
                    {feat.icon}
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. HÌNH ẢNH GIAO DIỆN (GALLERY - TABS & SCREENSHOTS FROM RAPNHA)
           ===================================================================== */}
        <section id="gallery" className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
            <div className="text-center space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                HÌNH ẢNH THỰC TẾ
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Xem thử giao diện ứng dụng
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
                Khám phá giao diện người dùng thực tế trên Android TV và MobiTV
              </p>

              {/* Tab Selector Buttons */}
              <div className="inline-flex p-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setGalleryTab('tv')}
                  className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                    galleryTab === 'tv'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>📺</span>
                  <span>Android TV &amp; TV Box</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryTab('mobile')}
                  className={`px-6 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                    galleryTab === 'mobile'
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/30'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>📱</span>
                  <span>Điện Thoại MobiTV</span>
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(galleryTab === 'tv' ? tvGallery : mobileGallery).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveLightbox(item)}
                  className="rounded-2xl overflow-hidden bg-[#0a0f1d] border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-black/60">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/20 text-[9px] font-extrabold text-amber-400">
                      {item.tag}
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-full bg-amber-500 text-black font-black text-xs flex items-center gap-1 shadow-lg">
                        🔍 Xem kích thước lớn
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LIGHTBOX MODAL */}
        {activeLightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setActiveLightbox(null)}
          >
            <div
              className="relative max-w-5xl w-full max-h-[90vh] bg-[#0c1220] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white text-base">
                    {activeLightbox.title}
                  </h3>
                  <p className="text-xs text-zinc-400">{activeLightbox.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLightbox(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-black flex items-center justify-center p-2">
                <img
                  src={activeLightbox.url}
                  alt={activeLightbox.title}
                  className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            6. DOWNLOAD CARD & QR CODE (2 SEPARATE APKs)
           ===================================================================== */}
        <section id="download" className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#12192b]/95 via-[#0d1322]/95 to-[#070b14]/95 border border-amber-500/40 p-6 sm:p-12 shadow-2xl shadow-amber-500/15 backdrop-blur-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              {/* Left 2 Cols: Info & Buttons */}
              <div className="lg:col-span-2 space-y-5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  TẢI VỀ ỨNG DỤNG
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Sẵn sàng cho buổi xem phim đầu tiên?
                </h2>
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                  2 bản APK riêng biệt tối ưu cho Android TV / TV Box và điện thoại MobiTV. Hoàn toàn miễn phí.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={apkTvDownloadUrl}
                    download="PHIMTNUI-AndroidTV.apk"
                    className="px-5 sm:px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105 cursor-pointer flex items-center gap-2"
                  >
                    <span>📺</span>
                    <span>Tải APK Android TV</span>
                  </a>
                  <a
                    href={apkMobileDownloadUrl}
                    download="PHIMTNUI-MobiTV.apk"
                    className="px-5 sm:px-6 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-400 hover:to-amber-400 text-black font-black text-xs sm:text-sm shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105 cursor-pointer flex items-center gap-2"
                  >
                    <span>📱</span>
                    <span>Tải APK MobiTV</span>
                  </a>
                  <a
                    href="https://github.com/kimjubim2-bot/Nuvio-addon/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-zinc-200 font-bold text-xs sm:text-sm border border-white/10 transition-colors"
                  >
                    Các phiên bản
                  </a>
                </div>

                {/* SHA-256 Checksum Badge */}
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 border border-white/10 font-mono text-[10px] sm:text-[11px] text-zinc-300 overflow-x-auto max-w-full">
                    <span className="text-amber-400 font-bold shrink-0">SHA-256:</span>
                    <span className="truncate">
                      ac5b1ecbc980679295b8c6cc8095caca05de566eff051ca7a06dc072a2943cd0
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 1 Col: Dynamic QR Code */}
              <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white text-black shadow-2xl space-y-3">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Tải APK PHIMTNUI"
                  className="w-44 h-44 object-contain rounded-lg"
                />
                <span className="text-xs font-black text-zinc-900 tracking-tight text-center">
                  Quét bằng điện thoại để tải APK MobiTV
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            7. 2-MINUTE INSTALLATION GUIDE
           ===================================================================== */}
        <section id="install-guide" className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
            <div className="text-center space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                CÀI ĐẶT
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Cài trong 2 phút
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto">
                PHIMTNUI phát hành dưới dạng file APK nên chưa có trên CH Play. Làm theo các bước
                dưới đây.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* GUIDE 1: PHONE */}
              <div className="rounded-3xl bg-[#0b101c]/90 border border-white/10 p-6 sm:p-8 space-y-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 text-lg font-black text-white">
                  <span className="text-2xl">📱</span>
                  <span>Trên điện thoại (Samsung S24 / Android)</span>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Bấm <strong className="text-white">Tải APK MobiTV</strong> ở trên (hoặc quét mã QR).
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Mở file vừa tải. Nếu máy hỏi, bật{' '}
                      <strong className="text-white">Cho phép cài từ nguồn này</strong> cho trình duyệt.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Bấm <strong className="text-white">Cài đặt</strong>, mở app và nhập mật khẩu bảo
                      mật. Xong!
                    </p>
                  </div>
                </div>
              </div>

              {/* GUIDE 2: ANDROID TV / TV BOX */}
              <div className="rounded-3xl bg-[#0b101c]/90 border border-white/10 p-6 sm:p-8 space-y-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 text-lg font-black text-white">
                  <span className="text-2xl">📺</span>
                  <span>Trên Android TV / Xiaomi TV / TV Box</span>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Cài app <strong className="text-white">Downloader</strong> (của AFTVnews) từ CH Play
                      trên TV.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Mở Downloader, nhập địa chỉ tải{' '}
                      <code className="px-2 py-0.5 rounded bg-black text-amber-300 font-mono text-xs">
                        github.com/kimjubim2-bot/Nuvio-addon
                      </code>{' '}
                      rồi bấm Go.
                    </p>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Khi TV hỏi, cho phép{' '}
                      <strong className="text-white">Downloader cài ứng dụng không rõ nguồn</strong>,
                      rồi bấm <strong className="text-white">Cài đặt</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            8. CÂU HỎI THƯỜNG GẶP (FAQ - INSPIRED BY RAPNHA)
           ===================================================================== */}
        <section id="faq" className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                HỎI ĐÁP
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Câu hỏi thường gặp
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[#0b101c]/90 border border-white/10 overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left font-bold text-white text-sm sm:text-base flex items-center justify-between hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <span className="text-amber-400 text-lg transition-transform duration-300">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-white/5 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================================
            9. FOOTER (BRAND: PHIMTNUI)
           ===================================================================== */}
        <footer className="py-12 border-t border-white/10 text-center text-xs text-zinc-500 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-500 text-black font-black flex items-center justify-center text-xs">
              P
            </div>
            <span className="font-bold text-zinc-300 text-sm">PHIMTNUI</span>
          </div>
          <p>© 2026 PHIMTNUI. Phát hành mã nguồn mở MIT License.</p>
          <p className="text-[11px] text-zinc-600 max-w-xl mx-auto px-4">
            Tất cả dữ liệu được tổng hợp tự động từ các nguồn công khai phục vụ mục đích nghiên cứu và
            trải nghiệm cá nhân.
          </p>
        </footer>
      </div>
    </div>
  );
};
