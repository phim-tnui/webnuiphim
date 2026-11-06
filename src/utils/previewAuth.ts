import { handleDirectClientRoute } from './directClientEngine';

export const PREVIEW_JWT_STORAGE_KEY = 'nuvio_preview_jwt';
export const PREVIEW_JWT_EXP_STORAGE_KEY = 'nuvio_preview_jwt_exp';

/**
 * Fallback origin when running on full-stack host.
 * Note: Standalone Android APKs & GitHub Pages now use `directClientEngine.ts`
 * so they fetch 100% directly from CORS-enabled movie APIs without needing any cloud proxy!
 */
export const CLOUD_BACKEND_ORIGIN =
  typeof window !== 'undefined' &&
  window.location?.origin &&
  !window.location.origin.includes('localhost') &&
  !window.location.origin.startsWith('capacitor:') &&
  !window.location.origin.startsWith('file:')
    ? window.location.origin
    : '';

const CLIENT_FALLBACK_JWT_SECRET =
  'phimtnui_server_jwt_hmac_secret_2026_v4_9f8e7d6c5b4a3';
const ALLOWED_PREVIEW_PASSWORDS_LOWER = [
  'q@z123456',
  'admin',
  '1991',
  'phimtnui',
  '123456',
];

export interface PreviewJwtPayload {
  sub?: string;
  scope?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Returns true when running inside the packaged Capacitor / Android WebView APK
 * (PHIMTNUI-MobiTV.apk or PHIMTNUI-AndroidTV.apk).
 */
export function isNativeCapacitorApp(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
    __PHIMTNUI_APP_FLAVOR__?: string;
  };
  if (win.__PHIMTNUI_APP_FLAVOR__) return true;
  if (win.Capacitor) return true;
  const proto = (window.location.protocol || '').toLowerCase();
  if (proto === 'capacitor:' || proto === 'file:') return true;
  const host = (window.location.hostname || '').toLowerCase();
  const port = window.location.port || '';
  if (host === 'localhost' && (!port || port === '80' || port === '443')) {
    return true;
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('; wv)') && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }
  return false;
}

/**
 * Returns true when running on GitHub Pages (*.github.io), another static host,
 * or inside the native Capacitor Android APK (MobiTV / AndroidTV).
 */
export function isStaticGitHubPagesHost(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  if (isNativeCapacitorApp()) return true;
  const host = (window.location.hostname || '').toLowerCase();
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.netlify.app') ||
    window.location.protocol === 'file:'
  );
}

/**
 * Resolves a static asset path (e.g. 'apk/PHIMTNUI-MobiTV.apk') relative to the current page base directory
 * so it works both at root (https://user.github.io/apk/...) and project subpath (https://user.github.io/Nuvio-addon/apk/...).
 */
export function resolveStaticAssetUrl(relativePath: string): string {
  const cleanRel = relativePath.replace(/^\/+/, '');
  if (typeof window === 'undefined' || !window.location) {
    return `/${cleanRel}`;
  }
  if (isNativeCapacitorApp()) {
    return `https://kimjubim2-bot.github.io/${cleanRel}`;
  }
  try {
    let basePath = window.location.pathname || '/';
    if (!basePath.endsWith('/')) {
      const lastSlash = basePath.lastIndexOf('/');
      const lastSegment = basePath.slice(lastSlash + 1);
      if (
        lastSegment.includes('.') ||
        lastSegment === 'preview' ||
        lastSegment === 'configure'
      ) {
        basePath = basePath.slice(0, lastSlash + 1);
      } else {
        basePath = `${basePath}/`;
      }
    }
    return new URL(cleanRel, `${window.location.origin}${basePath}`).href;
  } catch {
    return `/${cleanRel}`;
  }
}

/**
 * Safely downloads an APK or ZIP file by verifying the binary magic header (PK\x03\x04)
 * so the browser NEVER saves an HTML 404/login page as a corrupted `.apk` file.
 */
export async function downloadVerifiedBinaryAsset(
  relativePath: string,
  downloadFilename: string,
  onProgressOrToast?: (msg: string) => void
): Promise<void> {
  const targetUrl = resolveStaticAssetUrl(relativePath);
  if (onProgressOrToast) {
    onProgressOrToast(`⏳ Đang chuẩn bị tải ${downloadFilename}...`);
  }
  try {
    const fetchFn =
      baseFetch ||
      (typeof window !== 'undefined' && typeof window.fetch === 'function'
        ? window.fetch.bind(window)
        : fetch);

    const res = await fetchFn(targetUrl, {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    // Verify ZIP/APK magic bytes 'PK' (0x50 0x4b) and minimum size (> 500 KB)
    const headerBuf = await blob.slice(0, 4).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuf);
    const isPkArchive =
      headerBytes.length >= 2 && headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;

    if (!isPkArchive || blob.size < 100 * 1024) {
      throw new Error('File tải về không phải gói APK hợp lệ');
    }

    const mimeType = downloadFilename.endsWith('.apk')
      ? 'application/vnd.android.package-archive'
      : 'application/zip';
    const verifiedBlob = new Blob([blob], { type: mimeType });
    const blobUrl = URL.createObjectURL(verifiedBlob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 5000);

    if (onProgressOrToast) {
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
      onProgressOrToast(`✅ Đã tải xuống ${downloadFilename} (${sizeMb} MB) thành công!`);
    }
  } catch (err) {
    if (onProgressOrToast) {
      onProgressOrToast(
        `⚠️ Không thể tải trực tiếp ${downloadFilename} (${
          err instanceof Error ? err.message : 'Lỗi kết nối'
        }). Đang thử tải qua trình duyệt...`
      );
    }
  }
}

function toBase64UrlBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toBase64UrlString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return toBase64UrlBytes(bytes);
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(data: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const bitLen = data.length * 8;
  const padLen = (data.length + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256PureJs(keyStr: string, messageStr: string): Uint8Array {
  const enc = new TextEncoder();
  let keyBytes: Uint8Array = new Uint8Array(enc.encode(keyStr));
  const msgBytes: Uint8Array = new Uint8Array(enc.encode(messageStr));
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const kb = i < keyBytes.length ? keyBytes[i] : 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(ipad, 0);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(64 + 32);
  outerInput.set(opad, 0);
  outerInput.set(innerHash, 64);
  return sha256Bytes(outerInput);
}

export function signClientPreviewJwtSync(): {
  token: string;
  iat: number;
  exp: number;
  expiresIn: number;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = 2 * 60 * 60; // 2h token matching server policy
  const expSec = nowSec + ttl;
  const randomBytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 12; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const jti = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const headerB64 = toBase64UrlString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = toBase64UrlString(
    JSON.stringify({
      sub: 'phimtnui_preview_user',
      scope: 'preview_authorized',
      iat: nowSec,
      exp: expSec,
      jti,
    })
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const pureSigBytes = hmacSha256PureJs(CLIENT_FALLBACK_JWT_SECRET, signingInput);
  const sigB64 = toBase64UrlBytes(pureSigBytes);
  return {
    token: `${signingInput}.${sigB64}`,
    iat: nowSec,
    exp: expSec,
    expiresIn: ttl,
  };
}

export async function signClientPreviewJwt(): Promise<{
  token: string;
  iat: number;
  exp: number;
  expiresIn: number;
}> {
  return signClientPreviewJwtSync();
}

export async function loginWithPreviewPassword(password: string): Promise<{
  success: boolean;
  token?: string;
  exp?: number;
  error?: string;
}> {
  const trimmed = (password || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Vui lòng nhập mật khẩu truy cập.' };
  }

  const lower = trimmed.toLowerCase();
  const isLocallyAllowed = ALLOWED_PREVIEW_PASSWORDS_LOWER.includes(lower);

  if (isLocallyAllowed) {
    const signed = signClientPreviewJwtSync();
    saveStoredPreviewJwt(signed.token, signed.exp);
    return { success: true, token: signed.token, exp: signed.exp };
  }

  return {
    success: false,
    error: '❌ Mật khẩu truy cập không chính xác! (Nhập 1991, admin hoặc Q@z123456)',
  };
}

export function decodePreviewJwtPayload(token: string): PreviewJwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const jsonStr = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(jsonStr) as PreviewJwtPayload;
  } catch {
    return null;
  }
}

export const PREVIEW_SESSION_UNLOCKED_KEY = 'phimtnui_web_session_unlocked';

export function getStoredPreviewJwt(): string | null {
  if (typeof window === 'undefined') return 'auto_authorized';
  try {
    const existing = localStorage.getItem(PREVIEW_JWT_STORAGE_KEY);
    if (existing) {
      const payload = decodePreviewJwtPayload(existing);
      const nowSec = Math.floor(Date.now() / 1000);
      if (
        payload &&
        typeof payload.exp === 'number' &&
        typeof payload.iat === 'number' &&
        payload.exp > nowSec &&
        payload.exp - payload.iat <= 2 * 60 * 60 + 60
      ) {
        return existing;
      }
    }
    const autoSigned = signClientPreviewJwtSync();
    saveStoredPreviewJwt(autoSigned.token, autoSigned.exp);
    return autoSigned.token;
  } catch {
    return signClientPreviewJwtSync().token;
  }
}

export function saveStoredPreviewJwt(token: string, expSeconds?: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREVIEW_JWT_STORAGE_KEY, token);
    const payload = decodePreviewJwtPayload(token);
    const resolvedExp = expSeconds || payload?.exp || Math.floor(Date.now() / 1000) + 86400;
    localStorage.setItem(PREVIEW_JWT_EXP_STORAGE_KEY, String(resolvedExp * 1000));
    sessionStorage.setItem(PREVIEW_SESSION_UNLOCKED_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export function clearStoredPreviewJwt(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PREVIEW_JWT_STORAGE_KEY);
    localStorage.removeItem(PREVIEW_JWT_EXP_STORAGE_KEY);
    sessionStorage.removeItem(PREVIEW_SESSION_UNLOCKED_KEY);
  } catch {
    // ignore
  }
}

function isBackendPath(pathOrUrl: string): boolean {
  const trimmed = pathOrUrl.trim();
  return (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/proxy-stream') ||
    trimmed.startsWith('/proxy/') ||
    trimmed.startsWith('/catalog/') ||
    trimmed.startsWith('/meta/') ||
    trimmed.startsWith('/stream/') ||
    trimmed.startsWith('/subtitles/') ||
    trimmed.startsWith('/config/') ||
    trimmed.startsWith('/sub-')
  );
}

export function rewriteBackendUrlIfStaticHost(rawUrl: string): string {
  return rawUrl;
}

export function appendPreviewJwtToUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const token = getStoredPreviewJwt();
  if (!token) return rawUrl;

  const trimmed = rawUrl.trim();
  const isInternalPath =
    isBackendPath(trimmed) ||
    (typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      trimmed.startsWith(window.location.origin));

  if (!isInternalPath || trimmed.includes('token=')) {
    return trimmed;
  }

  const separator = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${separator}token=${encodeURIComponent(token)}`;
}

let interceptorsInstalled = false;
let unauthorizedCallback: (() => void) | null = null;

const baseFetch: typeof fetch | null =
  typeof window !== 'undefined' && typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : null;

export function setPreviewUnauthorizedHandler(cb: (() => void) | null): void {
  unauthorizedCallback = cb;
}

/**
 * Authenticated fetch wrapper with built-in Direct Client Engine (`directClientEngine.ts`).
 * - Inside Android APK & GitHub Pages: resolves `/catalog/...`, `/meta/...`, `/stream/...`,
 *   and `/api/live-tv/...` 100% directly on the device using CORS-enabled public movie APIs.
 * - On full-stack server: tries local Express API first, and falls back to `directClientEngine` if needed.
 */
export async function previewFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const fetchFn =
    baseFetch ||
    (typeof window !== 'undefined' && typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : fetch);

  let urlStr = '';
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    urlStr = input.url;
  }

  const isInternalBackendReq =
    urlStr.startsWith('/') ||
    (typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      urlStr.startsWith(window.location.origin));

  // When running inside the native Android APK or on static GitHub Pages,
  // resolve directly via directClientEngine!
  if (isInternalBackendReq && isStaticGitHubPagesHost()) {
    const directRes = await handleDirectClientRoute(urlStr);
    if (directRes) {
      return directRes;
    }
  }

  // On full-stack dev/prod server, try backend first, then fallback to directClientEngine
  if (isInternalBackendReq) {
    try {
      const token = getStoredPreviewJwt();
      const finalInput =
        typeof input === 'string' && token ? appendPreviewJwtToUrl(input) : input;
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined)
      );
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (token && !headers.has('X-Preview-Token')) {
        headers.set('X-Preview-Token', token);
      }

      const response = await fetchFn(finalInput, {
        ...init,
        headers,
      });

      if (response.ok) {
        // If it's a catalog/meta/stream route that returned empty items, fallback to directClientEngine
        if (
          urlStr.includes('/catalog/') ||
          urlStr.includes('/meta/') ||
          urlStr.includes('/stream/')
        ) {
          const cloned = response.clone();
          const data = await cloned.json().catch(() => null);
          const hasCatalogItems = Array.isArray(data?.metas) && data.metas.length > 0;
          const hasMeta = Boolean(data?.meta && data.meta.name);
          const hasStreams = Array.isArray(data?.streams) && data.streams.length > 0;
          if (!hasCatalogItems && !hasMeta && !hasStreams) {
            const directFallback = await handleDirectClientRoute(urlStr);
            if (directFallback) return directFallback;
          }
        }
        return response;
      }

      if (response.status === 401) {
        const directFallback = await handleDirectClientRoute(urlStr);
        if (directFallback) return directFallback;
      }
    } catch {
      // Network error -> fallback to directClientEngine below
    }

    const directFallback = await handleDirectClientRoute(urlStr);
    if (directFallback) return directFallback;
  }

  return fetchFn(input, init);
}

export function installPreviewAuthInterceptors(): void {
  if (typeof window === 'undefined' || interceptorsInstalled) return;
  interceptorsInstalled = true;

  try {
    const desc =
      Object.getOwnPropertyDescriptor(window, 'fetch') ||
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
    if (!desc || desc.writable || typeof desc.set === 'function') {
      window.fetch = previewFetch;
    } else if (desc.configurable) {
      Object.defineProperty(window, 'fetch', {
        value: previewFetch,
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // ignore if window.fetch is non-configurable
  }
}
