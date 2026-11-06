/**
 * ============================================================================
 * HERO SPOTLIGHT IMAGE OPTIMIZERS ("🔥 Phim Đề Cử Hôm Nay")
 * ============================================================================
 * Enforces strict performance rules:
 * 1. Background Image: High-Definition (HD/FHD) crisp master backdrop (no blur).
 * 2. Left-Side Featured Poster: Highly compressed, web-optimized, zero heavy FHD/4K assets.
 * 3. Bottom-Right Recommendation Carousel: Micro-resolution fragments (< 6KB) for 0ms cycling.
 */

/**
 * Optimizes the Featured Movie Poster (left-side container).
 * Strictly forbids heavy HD / FHD image assets. Uses web-optimized compressed formats.
 */
export function getCompressedFastPosterUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const clean = rawUrl.trim();
  if (!clean) return '';

  // 1. If it's a TMDB image, never request original, w1280, or w780. Downgrade to web-optimized w342.
  if (clean.includes('image.tmdb.org')) {
    return clean.replace(/\/t\/p\/(original|w1280|w780|w500)\//, '/t/p/w342/');
  }

  // 2. If it's an Unsplash placeholder or generic external image, request compressed web format
  if (clean.includes('unsplash.com')) {
    const base = clean.split('?')[0];
    return `${base}?w=340&q=70&auto=format&fit=crop`;
  }

  // 3. For Vietnamese CDN URLs (phimimg.com, img.ophim.cc, etc.), they are already ~30-40KB posters.
  // Return directly to leverage multi-CDN failover and caching.
  return clean;
}

/**
 * Optimizes the Recommendation Carousel Thumbnails (bottom-right container).
 * Strictly forbids HD or FHD quality assets. Serves ultra-lightweight micro fragments (< 6KB)
 * to ensure near-instantaneous load times during fast navigation.
 */
export function getMicroThumbnailUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const clean = rawUrl.trim();
  if (!clean) return '';

  // 1. If it's a TMDB image, downgrade from heavy sizes to tiny w92 micro thumbnail (< 5KB)
  if (clean.includes('image.tmdb.org')) {
    return clean.replace(/\/t\/p\/(original|w1280|w780|w500|w342)\//, '/t/p/w92/');
  }

  // 2. If it's an Unsplash URL, request micro dimensions
  if (clean.includes('unsplash.com')) {
    const base = clean.split('?')[0];
    return `${base}?w=100&h=150&q=50&auto=format&fit=crop`;
  }

  // 3. For any standard web / CDN URL, route through fast image CDN cache to compress to 96x144 WebP (~4KB)
  if (clean.startsWith('http') && !clean.includes('wsrv.nl')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=96&h=144&fit=cover&output=webp&q=55`;
  }

  return clean;
}
