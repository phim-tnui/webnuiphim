export const PREVIEW_JWT_STORAGE_KEY = 'nuvio_preview_jwt';
export const PREVIEW_JWT_EXP_STORAGE_KEY = 'nuvio_preview_jwt_exp';

export const CLOUD_BACKEND_ORIGIN =
  'https://ais-pre-tx4m6es377kkltwjaz6lom-707162265763.asia-northeast1.run.app';

export interface PreviewJwtPayload {
  sub?: string;
  scope?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Detects whether the app is running inside a packaged Capacitor APK (https://localhost)
 * or a static hosting domain (e.g. *.github.io) without a local Node backend.
 */
export function isStandaloneOrStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location?.hostname || '').toLowerCase();
  const proto = (window.location?.protocol || '').toLowerCase();
  if (proto === 'capacitor:' || proto === 'file:') return true;
  if (host === 'localhost' || host === '127.0.0.1') {
    const port = window.location?.port || '';
    // In Capacitor Android WebView, origin is https://localhost with no port (or port 80/443)
    if (!port || port === '80' || port === '443') return true;
  }
  if (host.endsWith('.github.io') || host.endsWith('.pages.dev') || host.endsWith('.netlify.app')) {
    return true;
  }
  return false;
}

/**
 * Resolves any relative backend path (/api/*, /catalog/*, /meta/*, /stream/*, /apk/*)
 * to the live Cloud Run backend when running inside the Android APK or GitHub Pages.
 */
export function resolveBackendUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const trimmed = rawUrl.trim();
  const isBackendPath =
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/proxy-stream') ||
    trimmed.startsWith('/proxy/') ||
    trimmed.startsWith('/catalog/') ||
    trimmed.startsWith('/meta/') ||
    trimmed.startsWith('/stream/') ||
    trimmed.startsWith('/subtitles/') ||
    trimmed.startsWith('/config/') ||
    trimmed.startsWith('/sub-') ||
    trimmed.startsWith('/manifest.json') ||
    trimmed.startsWith('/apk/');

  if (isBackendPath && isStandaloneOrStaticHost()) {
    return `${CLOUD_BACKEND_ORIGIN}${trimmed}`;
  }
  return trimmed;
}

/**
 * Returns a guaranteed direct binary download URL for the compiled Android APKs.
 * On GitHub Pages or inside Capacitor, routes directly to the Cloud Run binary endpoint
 * so the browser never downloads a 404 HTML fallback page.
 */
export function getUniversalApkDownloadUrl(
  filename: 'PHIMTNUI-MobiTV.apk' | 'PHIMTNUI-AndroidTV.apk' | 'PHIMTNUI-GitHub-Pages.zip'
): string {
  if (typeof window === 'undefined') {
    return `${CLOUD_BACKEND_ORIGIN}/apk/${filename}`;
  }
  if (isStandaloneOrStaticHost()) {
    return `${CLOUD_BACKEND_ORIGIN}/apk/${filename}`;
  }
  return `${window.location.origin}/apk/${filename}`;
}

/**
 * Pure-JS SHA-256 & HMAC-SHA256 implementation so Android WebViews and HTTP/static pages
 * without crypto.subtle still generate valid HMAC-SHA256 JWT tokens matching the server.
 */
function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(ascii: Uint8Array): Uint8Array {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const paddedLength = Math.ceil((ascii.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(ascii);
  padded[ascii.length] = 0x80;

  for (i = 0; i < paddedLength; i += 4) {
    words[i >> 2] =
      (padded[i] << 24) |
      (padded[i + 1] << 16) |
      (padded[i + 2] << 8) |
      padded[i + 3];
  }
  words[words.length - 2] = Math.floor(asciiBitLength / maxWord);
  words[words.length - 1] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
      void i2;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const out = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    out[i * 4] = (hash[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (hash[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (hash[i] >>> 8) & 0xff;
    out[i * 4 + 3] = hash[i] & 0xff;
  }
  return out;
}

function hmacSha256Bytes(keyStr: string, messageStr: string): Uint8Array {
  const enc = new TextEncoder();
  let keyBytes = enc.encode(keyStr);
  const msgBytes = enc.encode(messageStr);
  const blockSize = 64;

  if (keyBytes.length > blockSize) {
    keyBytes = sha256Bytes(keyBytes);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    const kByte = keyBytes[i] || 0;
    oKeyPad[i] = kByte ^ 0x5c;
    iKeyPad[i] = kByte ^ 0x36;
  }

  const innerInput = new Uint8Array(blockSize + msgBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(msgBytes, blockSize);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, blockSize);
  return sha256Bytes(outerInput);
}

function base64UrlEncodeString(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verifies the user's password and generates a signed 24-hour JWT token locally
 * so Android TV, MobiTV APK, and GitHub Pages work 100% reliably even if the network
 * or cross-origin POST is blocked.
 */
export async function verifyPasswordAndGenerateLocalJwt(
  passwordInput: string
): Promise<{ success: boolean; token?: string; exp?: number; error?: string }> {
  const normalized = (passwordInput || '').trim().toLowerCase();
  const validPasswords = ['q@z123456', '1991', 'admin', 'phimtnui', '123456'];

  if (!validPasswords.includes(normalized)) {
    return {
      success: false,
      error: 'Mật khẩu không đúng. Gợi ý: Q@z123456 hoặc 1991',
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 86400; // 24 hours
  const headerB64 = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncodeString(
    JSON.stringify({
      sub: 'preview_web_user',
      scope: 'preview_api_access',
      iat: nowSec,
      exp: expSec,
      jti: `local_${nowSec}`,
    })
  );
  const signingInput = `${headerB64}.${payloadB64}`;
  const secret = 'nuvio_jwt_secret_key_Q@z123456_anti_bot_v2';
  const sigBytes = hmacSha256Bytes(secret, signingInput);
  const sigB64 = base64UrlEncodeBytes(sigBytes);

  return {
    success: true,
    token: `${signingInput}.${sigB64}`,
    exp: expSec,
  };
}

/**
 * Decode payload from standard JWT (header.payload.signature).
 */
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

/**
 * Retrieve stored JWT token if present and not expired.
 */
export function getStoredPreviewJwt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem(PREVIEW_JWT_STORAGE_KEY);
    if (!token) return null;
    const payload = decodePreviewJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      clearStoredPreviewJwt();
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      clearStoredPreviewJwt();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveStoredPreviewJwt(token: string, expSeconds?: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREVIEW_JWT_STORAGE_KEY, token);
    const payload = decodePreviewJwtPayload(token);
    const resolvedExp = expSeconds || payload?.exp || Math.floor(Date.now() / 1000) + 86400;
    localStorage.setItem(PREVIEW_JWT_EXP_STORAGE_KEY, String(resolvedExp * 1000));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredPreviewJwt(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PREVIEW_JWT_STORAGE_KEY);
    localStorage.removeItem(PREVIEW_JWT_EXP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Appends `?token=<jwt>` or `&token=<jwt>` to internal proxy, stream, player, and API URLs
 * and resolves relative backend paths to the Cloud Run server when running inside an APK or GitHub Pages.
 */
export function appendPreviewJwtToUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const resolved = resolveBackendUrl(rawUrl);
  const token = getStoredPreviewJwt();
  if (!token) return resolved;

  const trimmed = resolved.trim();
  const isInternalOrCloud =
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/proxy-stream') ||
    trimmed.startsWith('/proxy/') ||
    trimmed.startsWith('/catalog/') ||
    trimmed.startsWith('/meta/') ||
    trimmed.startsWith('/stream/') ||
    trimmed.startsWith('/subtitles/') ||
    trimmed.startsWith('/config/') ||
    trimmed.startsWith('/sub-') ||
    trimmed.startsWith(CLOUD_BACKEND_ORIGIN);

  let isSameOriginAbsolute = false;
  if (
    !isInternalOrCloud &&
    typeof window !== 'undefined' &&
    window.location?.origin &&
    trimmed.startsWith(window.location.origin)
  ) {
    isSameOriginAbsolute = true;
  }

  if (!isInternalOrCloud && !isSameOriginAbsolute) {
    return resolved;
  }

  if (trimmed.includes('token=')) {
    return resolved;
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
 * Authenticated fetch wrapper that resolves relative paths to Cloud Run in APK/GitHub Pages
 * and attaches the signed Preview JWT token.
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

  const token = getStoredPreviewJwt();
  let urlStr = '';
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    urlStr = input.url;
  }

  const resolvedUrlStr = resolveBackendUrl(urlStr);
  const isTargetBackend =
    resolvedUrlStr.startsWith('/') ||
    resolvedUrlStr.startsWith(CLOUD_BACKEND_ORIGIN) ||
    (typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      resolvedUrlStr.startsWith(window.location.origin));

  let finalInput: RequestInfo | URL =
    typeof input === 'string' ? resolvedUrlStr : input;
  let nextInit: RequestInit = init ? { ...init } : {};

  if (isTargetBackend) {
    if (typeof finalInput === 'string' && token) {
      finalInput = appendPreviewJwtToUrl(finalInput);
    }
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (token && !headers.has('X-Preview-Token')) {
      headers.set('X-Preview-Token', token);
    }
    nextInit = {
      ...nextInit,
      headers,
      credentials: resolvedUrlStr.startsWith(CLOUD_BACKEND_ORIGIN) && isStandaloneOrStaticHost()
        ? 'omit'
        : nextInit.credentials || 'same-origin',
    };
  }

  const response = await fetchFn(finalInput, nextInit);

  if (
    response.status === 401 &&
    isTargetBackend &&
    !resolvedUrlStr.includes('/api/auth/preview-login') &&
    !resolvedUrlStr.includes('/api/auth/preview-verify')
  ) {
    // Only clear if we are NOT in offline/local token mode
    if (!isStandaloneOrStaticHost()) {
      clearStoredPreviewJwt();
      if (unauthorizedCallback) {
        unauthorizedCallback();
      }
    }
  }

  return response;
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
    // ignore
  }

  try {
    const nativeXhrOpen = XMLHttpRequest.prototype.open;
    const nativeXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      const rawStr = typeof url === 'string' ? url : url.toString();
      const updatedUrl = appendPreviewJwtToUrl(rawStr);
      // @ts-expect-error attach metadata for send()
      this.__isSameOriginPreviewReq =
        updatedUrl.startsWith('/') ||
        updatedUrl.startsWith(CLOUD_BACKEND_ORIGIN) ||
        (window.location?.origin && updatedUrl.startsWith(window.location.origin));
      return nativeXhrOpen.call(
        this,
        method,
        updatedUrl,
        async !== undefined ? async : true,
        username,
        password
      );
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      try {
        // @ts-expect-error read metadata from open()
        if (this.__isSameOriginPreviewReq) {
          const token = getStoredPreviewJwt();
          if (token) {
            this.setRequestHeader('Authorization', `Bearer ${token}`);
            this.setRequestHeader('X-Preview-Token', token);
          }
        }
      } catch {
        // ignore
      }
      return nativeXhrSend.call(this, body);
    };
  } catch {
    // ignore
  }
}
