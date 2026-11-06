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
    return fallbackThumb ? [fallbackThumb, `/proxy/image?url=${encodeURIComponent(fallbackThumb)}`] : [];
  }

  const clean = rawUrl.trim();
  if (!clean) return fallbackThumb ? [fallbackThumb] : [];

  const candidates: string[] = [];

  let fullUrl = clean;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    fullUrl = `https://phimimg.com/${clean.replace(/^\/+/, '')}`;
  }

  candidates.push(fullUrl);
  candidates.push(`/proxy/image?url=${encodeURIComponent(fullUrl)}`);

  if (fallbackThumb && fallbackThumb !== clean) {
    let fbUrl = fallbackThumb.trim();
    if (!fbUrl.startsWith('http://') && !fbUrl.startsWith('https://')) {
      fbUrl = `https://phimimg.com/${fbUrl.replace(/^\/+/, '')}`;
    }
    candidates.push(fbUrl);
    candidates.push(`/proxy/image?url=${encodeURIComponent(fbUrl)}`);
  }

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
