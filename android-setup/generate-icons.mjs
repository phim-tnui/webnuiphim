import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Pure Node.js PNG encoder (RGBA 8-bit)
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    rawData[rowStart] = 0; // filter type 0
    for (let x = 0; x < width * 4; x++) {
      rawData[rowStart + 1 + x] = rgba[y * width * 4 + x];
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Helper for smooth signed-distance field anti-aliasing
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function sdRoundedBox(px, py, cx, cy, bw, bh, r) {
  const qx = Math.abs(px - cx) - bw + r;
  const qy = Math.abs(py - cy) - bh + r;
  return (
    Math.min(Math.max(qx, qy), 0.0) +
    Math.hypot(Math.max(qx, 0.0), Math.max(qy, 0.0)) -
    r
  );
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function renderIconPng(size, isRound = false) {
  const rgba = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Normalized coordinates [0, 108]
      const nx = ((x + 0.5) / size) * 108;
      const ny = ((y + 0.5) / size) * 108;

      // Outer mask (circle if isRound, else squircle)
      let maskDist;
      if (isRound) {
        maskDist = Math.hypot(nx - 54, ny - 54) - 51;
      } else {
        maskDist = sdRoundedBox(nx, ny, 54, 54, 50, 50, 22);
      }

      const outerAlpha = clamp(0.5 - maskDist, 0, 1);
      if (outerAlpha <= 0) continue;

      // Base Obsidian Luxury Gradient (#090A0F -> #141929)
      const tGrad = (nx + ny) / 216;
      let r = Math.round(9 + tGrad * 12);
      let g = Math.round(10 + tGrad * 14);
      let b = Math.round(15 + tGrad * 24);

      // Gold border ring around squircle/circle
      const borderDist = Math.abs(maskDist + 2.2) - 1.2;
      if (borderDist < 0.8) {
        const ba = clamp(0.5 - borderDist, 0, 1) * 0.75;
        r = Math.round(r * (1 - ba) + 245 * ba);
        g = Math.round(g * (1 - ba) + 158 * ba);
        b = Math.round(b * (1 - ba) + 11 * ba);
      }

      // Draw Stylized 'P' + Play Prism Monogram
      // 1. Left stem of P: x in [30, 42], y in [25, 83]
      const stemDist = sdRoundedBox(nx, ny, 36, 54, 6.2, 29, 3);
      // 2. Top loop of P: outer rounded box + circle around (52, 44) radius 18
      const loopOuter = Math.hypot(nx - 52, ny - 44) - 18.5;
      const loopInner = Math.hypot(nx - 51, ny - 44) - 8.5;
      const inLoop =
        (nx >= 36 && nx <= 53 && ny >= 25.5 && ny <= 62.5 && Math.abs(ny - 44) >= 8.5) ||
        (nx >= 51 && loopOuter <= 0 && loopInner >= 0);

      // Gold-to-Crimson gradient color for P
      const pGrad = clamp((ny - 25) / 58, 0, 1);
      const pr = Math.round(253 * (1 - pGrad) + 234 * pGrad);
      const pg = Math.round(224 * (1 - pGrad) + 88 * pGrad);
      const pb = Math.round(71 * (1 - pGrad) + 12 * pGrad);

      if (stemDist <= 0.5 || inLoop) {
        r = pr;
        g = pg;
        b = pb;
      }

      // 3. Bright Champagne-White Play Triangle inside/overlapping P
      if (pointInTriangle(nx, ny, 48, 36, 74, 52, 48, 68)) {
        r = 255;
        g = 248;
        b = 220;
      }

      // 4. Crimson 4K Laser Dot at (72, 76)
      const dotDist = Math.hypot(nx - 72, ny - 76) - 5.2;
      if (dotDist < 0.5) {
        const da = clamp(0.5 - dotDist, 0, 1);
        r = Math.round(r * (1 - da) + 244 * da);
        g = Math.round(g * (1 - da) + 63 * da);
        b = Math.round(b * (1 - da) + 94 * da);
      }

      const idx = (y * size + x) * 4;
      rgba[idx] = clamp(r, 0, 255);
      rgba[idx + 1] = clamp(g, 0, 255);
      rgba[idx + 2] = clamp(b, 0, 255);
      rgba[idx + 3] = Math.round(outerAlpha * 255);
    }
  }

  void half;
  return encodePng(size, size, rgba);
}

// Render 320x180 Android TV Leanback Home Banner
function renderTvBannerPng(width = 320, height = 180) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const tx = x / width;
      const ty = y / height;

      // Deep Obsidian Cinema Backdrop with warm gold glow on left
      const glow = Math.max(0, 1 - Math.hypot(tx - 0.28, ty - 0.5) * 2.1);
      let r = Math.round(9 + glow * 48);
      let g = Math.round(11 + glow * 32);
      let b = Math.round(18 + glow * 10);

      // Gold border frame
      if (x < 3 || x >= width - 3 || y < 3 || y >= height - 3) {
        r = 245;
        g = 158;
        b = 11;
      }

      // Left Emblem Box centered at (90, 90) size 100x100
      const nx = ((x - 40) / 100) * 108;
      const ny = ((y - 40) / 100) * 108;
      if (nx >= 0 && nx <= 108 && ny >= 0 && ny <= 108) {
        const boxD = sdRoundedBox(nx, ny, 54, 54, 46, 46, 18);
        if (boxD <= 0) {
          r = 14;
          g = 18;
          b = 30;
          if (boxD > -2.5) {
            r = 245;
            g = 158;
            b = 11;
          }
          const stemDist = sdRoundedBox(nx, ny, 36, 54, 6.2, 29, 3);
          const loopOuter = Math.hypot(nx - 52, ny - 44) - 18.5;
          const loopInner = Math.hypot(nx - 51, ny - 44) - 8.5;
          const inLoop =
            (nx >= 36 && nx <= 53 && ny >= 25.5 && ny <= 62.5 && Math.abs(ny - 44) >= 8.5) ||
            (nx >= 51 && loopOuter <= 0 && loopInner >= 0);
          if (stemDist <= 0.5 || inLoop) {
            r = 245;
            g = 158;
            b = 11;
          }
          if (pointInTriangle(nx, ny, 48, 36, 74, 52, 48, 68)) {
            r = 255;
            g = 248;
            b = 220;
          }
        }
      }

      // Right side stylized golden cinema bars representing "PHIM.TNUI 4K TV"
      if (x >= 160 && x <= 290 && y >= 62 && y <= 84) {
        r = 250;
        g = 204;
        b = 21;
      }
      if (x >= 160 && x <= 255 && y >= 96 && y <= 112) {
        r = 244;
        g = 63;
        b = 94;
      }

      rgba[idx] = clamp(r, 0, 255);
      rgba[idx + 1] = clamp(g, 0, 255);
      rgba[idx + 2] = clamp(b, 0, 255);
      rgba[idx + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}

const resBase = path.join(process.cwd(), 'frontend/android/app/src/main/res');
const densities = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

for (const d of densities) {
  const dir = path.join(resBase, d.folder);
  fs.mkdirSync(dir, { recursive: true });
  const squarePng = renderIconPng(d.size, false);
  const roundPng = renderIconPng(d.size, true);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), squarePng);
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), squarePng);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), roundPng);
}

// Generate Android TV Banner
const drawableDir = path.join(resBase, 'drawable');
fs.mkdirSync(drawableDir, { recursive: true });
fs.writeFileSync(path.join(drawableDir, 'tv_banner.png'), renderTvBannerPng(320, 180));

// Generate Web Public Icons
const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIconPng(180, false));
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), renderIconPng(192, false));

const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FEF08A"/>
      <stop offset="40%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#E11D48"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="16" fill="#090A0F" stroke="url(#g)" stroke-width="3"/>
  <path d="M17 15C17 13.3431 18.3431 12 20 12H25C26.6569 12 28 13.3431 28 15V49C28 50.6569 26.6569 52 25 52H20C18.3431 52 17 50.6569 17 49V15Z" fill="url(#g)"/>
  <path d="M25 12H36.5C44.5081 12 51 18.4919 51 26.5C51 34.5081 44.5081 41 36.5 41H25V31.5H35.5C38.5376 31.5 41 29.0376 41 26C41 22.9624 38.5376 20.5 35.5 20.5H25V12Z" fill="url(#g)"/>
  <path d="M31 20.5L44.5 28.5L31 36.5V20.5Z" fill="#FFFBEB"/>
  <circle cx="46" cy="48" r="3.5" fill="#F43F5E"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgLogo);

console.log('Generated all PHIM.TNUI Android mipmap PNG icons, TV banner, and Web icons!');
