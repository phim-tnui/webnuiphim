import { CatalogMetaItem } from '../components/PreviewWebApp';

/**
 * ============================================================================
 * TMDB HIGH-RESOLUTION BACKDROP RESOLVER
 * ============================================================================
 * Lightweight, on-demand resolver for the single active spotlight movie banner.
 * - Does NOT preload or flood the network with background catalog lookups.
 * - Strict 2-second timeout to never block user catalog requests.
 * - Prioritizes the highest-voted official artwork with 16:9 ratio.
 */

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const CACHE_STORAGE_KEY = 'phimtnui_tmdb_backdrop_v3';
const MAX_LOCAL_CACHE = 150;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TmdbResolvedImages {
  backdrop4k: string;
  backdropHd: string;
  backdropThumb: string;
  posterHd?: string;
  logoUrl?: string;
  isTmdbEnhanced: boolean;
}

const memoryCache = new Map<string, TmdbResolvedImages>();
const inflightPromises = new Map<string, Promise<TmdbResolvedImages>>();

function readPersistentCache(cacheKey: string): TmdbResolvedImages | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[cacheKey];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
      return entry.data;
    }
  } catch {
    // ignore
  }
  return null;
}

function writePersistentCache(cacheKey: string, data: TmdbResolvedImages): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    const store: Record<string, { ts: number; data: TmdbResolvedImages }> = raw
      ? JSON.parse(raw)
      : {};

    store[cacheKey] = { ts: Date.now(), data };

    const keys = Object.keys(store);
    if (keys.length > MAX_LOCAL_CACHE) {
      keys.sort((a, b) => store[a].ts - store[b].ts);
      for (let i = 0; i < keys.length - MAX_LOCAL_CACHE; i++) {
        delete store[keys[i]];
      }
    }

    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/**
 * Pick the best landscape backdrop among TMDB backdrops
 */
function pickBestBackdrop(backdrops: any[]): string | null {
  if (!Array.isArray(backdrops) || backdrops.length === 0) return null;

  // Filter 16:9 or standard widescreen backdrops
  const widescreen = backdrops.filter(
    (b) => b?.file_path && b.aspect_ratio && b.aspect_ratio >= 1.6 && b.aspect_ratio <= 1.95
  );

  const candidatePool = widescreen.length > 0 ? widescreen : backdrops;

  // Sort by score: vote_count (weighted) + resolution bonus (1080p / 4K)
  const sorted = [...candidatePool].sort((a, b) => {
    const scoreA =
      (a.vote_count || 0) * 10 +
      (a.vote_average || 0) * 2 +
      (a.width >= 3840 ? 8 : a.width >= 1920 ? 5 : 0);
    const scoreB =
      (b.vote_count || 0) * 10 +
      (b.vote_average || 0) * 2 +
      (b.width >= 3840 ? 8 : b.width >= 1920 ? 5 : 0);
    return scoreB - scoreA;
  });

  return sorted[0]?.file_path || null;
}

/**
 * Resolve high-res backdrop only for the single active spotlight movie
 */
export async function resolveTmdbImages(
  item: CatalogMetaItem
): Promise<TmdbResolvedImages> {
  const fallbackThumb =
    item.background ||
    item.poster ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1280&auto=format&fit=crop';

  const defaultResult: TmdbResolvedImages = {
    backdrop4k: fallbackThumb,
    backdropHd: fallbackThumb,
    backdropThumb: fallbackThumb,
    posterHd: item.poster,
    isTmdbEnhanced: false,
  };

  const cacheKey = item.id || item.name || '';
  if (!cacheKey) return defaultResult;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const persistent = readPersistentCache(cacheKey);
  if (persistent) {
    memoryCache.set(cacheKey, persistent);
    return persistent;
  }

  if (inflightPromises.has(cacheKey)) {
    return inflightPromises.get(cacheKey)!;
  }

  const queryPromise = (async (): Promise<TmdbResolvedImages> => {
    try {
      const isSeries = item.type === 'series' || item.type === 'tv';
      let backdropPath: string | null = null;
      let posterPath: string | null = null;

      // 1. Try TMDB ID directly with strict 2-second timeout
      if (item.tmdbId) {
        const tmdbType = isSeries ? 'tv' : 'movie';
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/${tmdbType}/${item.tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null,vi`,
            { signal: AbortSignal.timeout(2000) }
          );
          if (res.ok) {
            const data = await res.json();
            backdropPath = pickBestBackdrop(data.backdrops);
            if (data.posters?.[0]?.file_path) {
              posterPath = data.posters[0].file_path;
            }
          }
        } catch {
          // ignore
        }
      }

      // 2. Try IMDb ID with strict 2-second timeout
      if (!backdropPath && item.imdbId) {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/find/${item.imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`,
            { signal: AbortSignal.timeout(2000) }
          );
          if (res.ok) {
            const data = await res.json();
            const match =
              (isSeries ? data.tv_results?.[0] : data.movie_results?.[0]) ||
              data.movie_results?.[0] ||
              data.tv_results?.[0];
            if (match?.backdrop_path) {
              backdropPath = match.backdrop_path;
            }
            if (match?.poster_path) {
              posterPath = match.poster_path;
            }
          }
        } catch {
          // ignore
        }
      }

      if (backdropPath) {
        const resolved: TmdbResolvedImages = {
          backdrop4k: `https://image.tmdb.org/t/p/original${backdropPath}`,
          backdropHd: `https://image.tmdb.org/t/p/w1280${backdropPath}`,
          backdropThumb: `https://image.tmdb.org/t/p/w300${backdropPath}`,
          posterHd: posterPath ? `https://image.tmdb.org/t/p/w780${posterPath}` : item.poster,
          isTmdbEnhanced: true,
        };

        memoryCache.set(cacheKey, resolved);
        writePersistentCache(cacheKey, resolved);
        return resolved;
      }
    } catch {
      // ignore
    }

    memoryCache.set(cacheKey, defaultResult);
    return defaultResult;
  })();

  inflightPromises.set(cacheKey, queryPromise);
  const finalResult = await queryPromise;
  inflightPromises.delete(cacheKey);
  return finalResult;
}

/**
 * No-op to prevent background network flooding
 */
export function preloadSpotlightCarousel(): void {
  // Deliberately no-op so catalog requests are never throttled
}
