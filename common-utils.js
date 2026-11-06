const fs = require('fs');
const path = require('path');
const axios = require('axios');

const os = require('os');

const IS_SERVERLESS = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
);

/**
 * Resolve readable file path: checks /tmp/<basename> first on serverless (in case updated at runtime),
 * then falls back to the bundled file in /var/task (__dirname / process.cwd()).
 */
function resolveReadablePath(filePath) {
    try {
        const baseName = path.basename(filePath);
        const tmpCandidate = path.join(os.tmpdir(), baseName);
        if (fs.existsSync(tmpCandidate)) {
            return tmpCandidate;
        }
    } catch (_) {}
    return filePath;
}

/**
 * Safely read and parse a JSON file with /tmp overlay support on Vercel.
 */
function readJsonSafe(filePath, fallback = null) {
    try {
        const target = resolveReadablePath(filePath);
        if (fs.existsSync(target)) {
            return JSON.parse(fs.readFileSync(target, 'utf-8'));
        }
    } catch (_) {}
    return fallback;
}

/**
 * 1. ATOMIC JSON FILE WRITER (VERCEL READ-ONLY FILESYSTEM SAFE)
 * Writes to /tmp automatically on Vercel Serverless or if target directory is read-only (EROFS).
 */
function atomicWriteJson(filePath, data, spaces = 2) {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, spaces);
    const targetPath = IS_SERVERLESS
        ? path.join(os.tmpdir(), path.basename(filePath))
        : filePath;

    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
        fs.writeFileSync(tempPath, content, 'utf-8');
        fs.renameSync(tempPath, targetPath);
        return true;
    } catch (err) {
        try {
            const tmpFallback = path.join(os.tmpdir(), path.basename(filePath));
            fs.writeFileSync(tmpFallback, content, 'utf-8');
            return true;
        } catch (fallbackErr) {
            console.warn(`[ATOMIC WRITE] Skipped read-only write for ${path.basename(filePath)}:`, fallbackErr.message);
            return false;
        }
    }
}

/**
 * 2. UNIVERSAL CLEARKEY PARSER
 * Supports both JSON Key Sets (base64url) and hex pairs (kid:key).
 */
function parseClearKey(rawKey) {
    if (!rawKey) return null;
    rawKey = String(rawKey).trim();
    if (rawKey.startsWith("{") && rawKey.includes("keys")) {
        try {
            const parsed = JSON.parse(rawKey);
            if (parsed.keys && parsed.keys.length > 0) {
                const item = parsed.keys[0];
                const base64UrlToHex = (b64) => {
                    let s = (b64 || "").replace(/-/g, '+').replace(/_/g, '/');
                    while (s.length % 4) s += '=';
                    return Buffer.from(s, 'base64').toString('hex');
                };
                if (item.kid && item.k) {
                    return {
                        kidHex: base64UrlToHex(item.kid).toLowerCase(),
                        keyHex: base64UrlToHex(item.k).toLowerCase()
                    };
                }
            }
        } catch (e) {}
    }
    if (rawKey.includes(":")) {
        const parts = rawKey.split(":");
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
            return {
                kidHex: parts[0].trim().toLowerCase(),
                keyHex: parts[1].trim().toLowerCase()
            };
        }
    }
    return null;
}

/**
 * 3. HIGH-PERFORMANCE STREAM LATENCY PROBE
 */
async function testStreamLatency(url, timeoutMs = 2400) {
    if (!url || !url.startsWith("http")) {
        return { reachable: false, alive: false, latency: 99999, status: 0 };
    }
    const start = Date.now();
    try {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Range": "bytes=0-1024",
            "Accept": "*/*"
        };
        if (url.includes("mytvnet.vn") || url.includes("mytvn.net") || url.includes("auraflix")) {
            headers["Referer"] = "https://auraflix.vip/";
            headers["Origin"] = "https://auraflix.vip";
        }
        const res = await axios.get(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers,
            validateStatus: (s) => s < 400 || s === 403 || s === 206
        });
        const content = typeof res.data === 'string' ? res.data : '';
        const isMpdOrM3u8 = (
            content.includes("#EXTM3U") ||
            content.includes("#EXTINF") ||
            content.includes("<MPD") ||
            (res.headers['content-type'] || '').includes('mpegurl') ||
            (res.headers['content-type'] || '').includes('dash')
        );
        const reachable = res.status < 400 || res.status === 206 || (res.status === 403 && isMpdOrM3u8);
        const latency = Date.now() - start;
        return {
            reachable,
            alive: reachable,
            latency,
            status: res.status,
            healthStatus: reachable ? (latency < 1200 ? 'active' : 'unstable') : 'offline'
        };
    } catch (e) {
        if (e.response && (e.response.status === 403 || e.response.status === 200) && (
            url.includes("fptplay") || url.includes("tv360") || url.includes("vtvgo") ||
            url.includes("vtc") || url.includes("mytvnet") || url.includes("mytvn.net")
        )) {
            return { reachable: true, alive: true, latency: 200, status: e.response.status, healthStatus: 'active' };
        }
        return { reachable: false, alive: false, latency: 99999, status: 0, healthStatus: 'offline', error: e.message };
    }
}

/**
 * 4. BOUNDED CONCURRENCY POOL (Lightweight p-limit)
 * Executes array of async tasks with strict maximum active worker bounds.
 */
async function boundedParallel(items, asyncFn, concurrency = 12) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const results = new Array(items.length);
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const curIdx = index++;
            try {
                results[curIdx] = await asyncFn(items[curIdx], curIdx);
            } catch (err) {
                results[curIdx] = null;
            }
        }
    }

    const workers = [];
    const workerCount = Math.min(concurrency, items.length);
    for (let i = 0; i < workerCount; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results;
}

module.exports = {
    atomicWriteJson,
    resolveReadablePath,
    readJsonSafe,
    parseClearKey,
    testStreamLatency,
    boundedParallel
};
