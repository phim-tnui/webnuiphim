/**
 * MULTI-CDN VIETNAMESE IMAGE RESOLVER & FAILOVER ENGINE
 * =====================================================
 * Tự động chuyển đổi thông minh đa nguồn CDN Việt Nam (KKPhim, OPhim, NguonC):
 * 1. Thử CDN ưu tiên (phimimg.com / direct URL).
 * 2. Nếu sau 1.2s CDN 1 không phản hồi hoặc báo lỗi 404/CORS, tự động chuyển sang CDN 2 (img.ophim.cc / img.phimapi.com).
 * 3. Nếu vẫn không được, chuyển sang CDN 3 (NguonC / VSMOV / thumb_url).
 * 4. Tự động nhận diện ảnh ngang (16:9) để căn giữa chuẩn rạp (object-center), không bị xén dải hẹp.
 * 5. Lưu bộ đệm URL thành công (Memory + SessionStorage) để nạp tức thì 0ms.
 */

const WORKING_URL_CACHE = new Map<string, string>();
const SESSION_CACHE_KEY = 'phimtnui_verified_cdn_posters_v1';

// Đọc cache từ sessionStorage khi khởi tạo
if (typeof window !== 'undefined') {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') WORKING_URL_CACHE.set(k, v);
      });
    }
  } catch {
    // ignore
  }
}

function persistWorkingUrl(key: string, url: string) {
  WORKING_URL_CACHE.set(key, url);
  if (typeof window === 'undefined') return;
  try {
    const current: Record<string, string> = {};
    let count = 0;
    WORKING_URL_CACHE.forEach((v, k) => {
      if (count < 200) {
        current[k] = v;
        count++;
      }
    });
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Sinh danh sách các URL CDN Việt Nam tiềm năng từ một URL gốc
 */
export function generateVietnameseCdnCandidates(rawUrl?: string, fallbackThumb?: string): string[] {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallbackThumb ? [fallbackThumb] : [];
  }

  const clean = rawUrl.trim();
  if (!clean) return fallbackThumb ? [fallbackThumb] : [];

  const candidates: string[] = [];

  // Nếu đã là link đầy đủ, thêm nó làm ứng viên số 1
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    candidates.push(clean);

    // Nếu là phimimg.com, sinh thêm link đối ứng của img.ophim.cc và img.phimapi.com
    if (clean.includes('phimimg.com')) {
      const pathPart = clean.replace(/^https?:\/\/phimimg\.com\//, '').replace(/^\/+/, '');
      // OPhim uploads
      candidates.push(`https://img.ophim.cc/uploads/movies/${pathPart.replace(/^upload\/vod\/\d+\//, '').replace(/^uploads?\/movies?\//, '')}`);
      // PhimAPI mirror
      candidates.push(`https://img.phimapi.com/${pathPart}`);
      // HTTP direct
      candidates.push(`http://phimimg.com/${pathPart}`);
    } else if (clean.includes('ophim') || clean.includes('img.ophim.cc')) {
      const pathPart = clean.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '');
      candidates.push(`https://phimimg.com/${pathPart}`);
      candidates.push(`https://img.phimapi.com/${pathPart}`);
    }
  } else {
    // Là đường dẫn tương đối (ví dụ: upload/vod/... hoặc ten-phim-poster.jpg)
    const cleanPath = clean.replace(/^\/+/, '');
    candidates.push(`https://phimimg.com/${cleanPath}`);
    candidates.push(`https://img.ophim.cc/uploads/movies/${cleanPath.replace(/^upload\/vod\/\d+\//, '').replace(/^uploads?\/movies?\//, '')}`);
    candidates.push(`https://img.phimapi.com/${cleanPath}`);
  }

  // Bổ sung ảnh thumb/background dự phòng nếu có
  if (fallbackThumb && !candidates.includes(fallbackThumb)) {
    candidates.push(fallbackThumb);
  }

  // Loại bỏ các URL trùng nhau
  return Array.from(new Set(candidates)).filter(Boolean);
}

/**
 * Lấy URL hoạt động tốt nhất đã được lưu trong bộ nhớ đệm
 */
export function getCachedWorkingCdnUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  return WORKING_URL_CACHE.get(rawUrl) || null;
}

/**
 * Ghi nhận một URL CDN đã tải thành công
 */
export function markCdnUrlSuccess(originalKey: string, workingUrl: string) {
  persistWorkingUrl(originalKey, workingUrl);
}
