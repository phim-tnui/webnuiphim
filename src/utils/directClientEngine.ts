import { CatalogMetaItem, StreamSourceItem } from '../components/PreviewWebApp';

/**
 * ============================================================================
 * PHIM.TNUI DIRECT CLIENT ENGINE (v4.1 - MULTI-SOURCE + CLEARKEY + DIRECT HLS)
 * ============================================================================
 * Fetches movies, series, episodes, search results, and 65+ verified Live TV
 * channels (ClearKey MPEG-DASH + Direct CORS HLS) across:
 *   1. KKPhim (https://phimapi.com)
 *   2. OPhim (https://ophim1.com)
 *   3. NguonC (https://phim.nguonc.com)
 * Supports filtering by source ('all' | 'kkphim' | 'ophim' | 'nguonc') and
 * aggregates all servers + direct .m3u8 / Embed links for every movie & channel.
 */

export type MovieSourceProvider = 'all' | 'kkphim' | 'ophim' | 'nguonc';

const SOURCE_STORAGE_KEY = 'phimtnui_preferred_movie_source';

export function getPreferredMovieSource(): MovieSourceProvider {
  if (typeof window === 'undefined') return 'all';
  try {
    const val = localStorage.getItem(SOURCE_STORAGE_KEY) as MovieSourceProvider;
    if (val === 'kkphim' || val === 'ophim' || val === 'nguonc' || val === 'all') {
      return val;
    }
  } catch {
    // ignore
  }
  return 'all';
}

export function setPreferredMovieSource(src: MovieSourceProvider): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOURCE_STORAGE_KEY, src);
  } catch {
    // ignore
  }
}

export interface DirectEpisodeItem {
  id: string;
  name: string;
  slug: string;
  episodeNumber: number;
  linkM3u8: string;
  linkEmbed: string;
  serverName: string;
  sourceProvider?: string;
}

export interface DirectMovieDetail {
  id: string;
  slug: string;
  name: string;
  originName: string;
  poster: string;
  background: string;
  year: string;
  quality: string;
  lang: string;
  episodeCurrent: string;
  time: string;
  duration?: string;
  tmdbVote?: string;
  description: string;
  country: string;
  countries: string[];
  genres: string[];
  director: string;
  directors: string[];
  actors: string[];
  type: 'movie' | 'series';
  servers: Array<{
    serverName: string;
    sourceProvider?: string;
    episodes: DirectEpisodeItem[];
  }>;
}

export interface DirectLiveTvChannel {
  id: string;
  name: string;
  group: 'vtv' | 'htv' | 'vtvcab' | 'thvl' | 'sports' | 'intl';
  groupLabel: string;
  poster: string;
  streamUrl: string;
  fallbackUrl?: string;
  backupUrls?: string[];
  description: string;
  isClearkey?: boolean;
  kidHex?: string;
  keyHex?: string;
}

/**
 * Generates a crisp, zero-latency SVG Data-URI broadcast logo badge.
 * Never fails offline or under ISP image blocks.
 */
export function createChannelLogoSvgDataUri(
  shortTitle: string,
  subBadge: string,
  bgStart: string,
  bgEnd: string,
  accentColor = '#F5C518'
): string {
  const cleanTitle = shortTitle.replace(/[<>&"']/g, '').slice(0, 14);
  const cleanSub = subBadge.replace(/[<>&"']/g, '').slice(0, 18);
  const fontSize = cleanTitle.length > 9 ? 30 : cleanTitle.length > 6 ? 38 : 46;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="320" height="180" rx="22" fill="url(#g)"/>
    <rect x="6" y="6" width="308" height="168" rx="18" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <circle cx="285" cy="30" r="7" fill="#ef4444"/>
    <text x="160" y="96" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Outfit, system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="1">${cleanTitle}</text>
    <rect x="85" y="128" width="150" height="28" rx="14" fill="rgba(0,0,0,0.42)" stroke="${accentColor}" stroke-width="1.5"/>
    <text x="160" y="143" text-anchor="middle" dominant-baseline="middle" fill="${accentColor}" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="800" font-size="13" letter-spacing="1.5">${cleanSub}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getChannelFallbackLogo(channelName: string, groupLabel = 'LIVE TV'): string {
  const n = (channelName || 'TV').toUpperCase();
  if (n.includes('VTV')) {
    const short = n.replace(/\s+HD.*$/, '').slice(0, 10);
    return createChannelLogoSvgDataUri(short, 'ĐÀI VTV HD', '#991b1b', '#450a0a', '#fbbf24');
  }
  if (n.includes('HTV')) {
    const short = n.replace(/\s+HD.*$/, '').slice(0, 11);
    return createChannelLogoSvgDataUri(short, 'ĐÀI HTV HD', '#0369a1', '#0c4a6e', '#38bdf8');
  }
  if (n.includes('THVL')) {
    const short = n.replace(/\s+HD.*$/, '').slice(0, 10);
    return createChannelLogoSvgDataUri(short, 'VĨNH LONG HD', '#b45309', '#451a03', '#fcd34d');
  }
  if (n.includes('SCTV') || n.includes('ON ')) {
    const short = n.replace(/\s+HD.*$/, '').slice(0, 11);
    return createChannelLogoSvgDataUri(short, 'TRUYỀN HÌNH CÁP', '#1d4ed8', '#1e1b4b', '#60a5fa');
  }
  const short = n.replace(/\s+(HD|FHD|4K).*$/, '').slice(0, 12);
  return createChannelLogoSvgDataUri(short, groupLabel.toUpperCase(), '#1e293b', '#090d16', '#F2B544');
}

// ============================================================================
// 65+ VERIFIED WORKING LIVE TV CHANNELS (HTTP 200 OK + CORS + CLEARKEY DRM)
// ============================================================================
export const DIRECT_LIVE_TV_CHANNELS: DirectLiveTvChannel[] = [
  // ==================== 1. ĐÀI VTV (VTV1 -> VTV9 & VTV CẦN THƠ) ====================
  {
    id: 'iptv_vtv1',
    name: 'VTV1 HD • Thời Sự',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV1', 'THỜI SỰ 24/7', '#dc2626', '#7f1d1d', '#fde047'),
    streamUrl: 'https://luuchieu.truyenhinhso.vn/media/live/C90B082632CD4A75F4B3EDB3/index.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=2',
    backupUrls: [
      'https://vmttv.dpdns.org/tv360/?id=vtv1',
      'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv2/playlist_360p.m3u8',
    ],
    description: 'Kênh Thời sự - Chính trị - Tổng hợp Quốc gia VTV1 HD',
  },
  {
    id: 'iptv_vtv2',
    name: 'VTV2 HD • Khoa Học & Giáo Dục',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV2', 'KHOA HỌC GIÁO DỤC', '#16a34a', '#14532d', '#86efac'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv2/playlist_360p.m3u8',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv2',
    backupUrls: ['https://freem3u.xyz/api/live/play.m3u8?vid=2'],
    description: 'Kênh Khoa học, Công nghệ và Giáo dục VTV2 HD',
  },
  {
    id: 'iptv_vtv3',
    name: 'VTV3 HD • Giải Trí & Phim Truyện',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV3', 'GIẢI TRÍ SỐ 1', '#2563eb', '#1e3a8a', '#93c5fd'),
    streamUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv3',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=110',
    backupUrls: ['https://luuchieu.truyenhinhso.vn/media/live/C90B082632CD4A75F4B3EDB3/index.m3u8'],
    description: 'Kênh Giải trí, Gameshow, Phim truyện giờ vàng VTV3 HD',
  },
  {
    id: 'iptv_vtv4',
    name: 'VTV4 HD • Đối Ngoại Quốc Tế',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV4', 'ĐỐI NGOẠI', '#0284c7', '#0c4a6e', '#7dd3fc'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv4/playlist_360p.m3u8',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv4',
    backupUrls: [],
    description: 'Kênh Truyền hình Đối ngoại Quốc gia VTV4 HD',
  },
  {
    id: 'iptv_vtv5',
    name: 'VTV5 HD • Dân Tộc & Phim Truyện',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV5', 'TRUYỀN HÌNH VTV', '#d97706', '#78350f', '#fde68a'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=110',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv5',
    backupUrls: ['https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv5tnb/playlist_360p.m3u8'],
    description: 'Kênh Truyền hình VTV5 HD & Thể thao trực tiếp',
  },
  {
    id: 'iptv_vtvcantho',
    name: 'VTV Cần Thơ (VTV6) • Thể Thao',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV CẦN THƠ', 'THỂ THAO MIỀN TÂY', '#e11d48', '#881337', '#fda4af'),
    streamUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv6',
    fallbackUrl: 'https://live.canthotv.vn/live/tv/master.m3u8',
    backupUrls: ['https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv5tnb/playlist_360p.m3u8'],
    description: 'VTV Cần Thơ (VTV6) — Trực tiếp Bóng đá, Thể thao & Đồng bằng Sông Cửu Long',
  },
  {
    id: 'iptv_vtv7',
    name: 'VTV7 HD • Giáo Dục & Thiếu Nhi',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV7', 'GIÁO DỤC QUỐC GIA', '#7c3aed', '#4c1d95', '#ddd6fe'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv7/playlist_360p.m3u8',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv7',
    backupUrls: [],
    description: 'Kênh Truyền hình Giáo dục Quốc gia & Thiếu nhi VTV7 HD',
  },
  {
    id: 'iptv_vtv8',
    name: 'VTV8 HD • Miền Trung & Tây Nguyên',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV8', 'MIỀN TRUNG HD', '#0d9488', '#134e4a', '#99f6e4'),
    streamUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv8',
    fallbackUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv5tn/playlist_360p.m3u8',
    backupUrls: [],
    description: 'Kênh Truyền hình khu vực Miền Trung - Tây Nguyên VTV8 HD',
  },
  {
    id: 'iptv_vtv9',
    name: 'VTV9 HD • Nam Bộ & Giải Trí',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV9', 'TP.HCM & NAM BỘ', '#ea580c', '#7c2d12', '#fed7aa'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv9/playlist_360p.m3u8',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=vtv9',
    backupUrls: [],
    description: 'Kênh Truyền hình khu vực TP.HCM & Nam Bộ VTV9 HD',
  },
  {
    id: 'iptv_vtv5taynambo',
    name: 'VTV5 Tây Nam Bộ HD',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV5 TNB', 'TÂY NAM BỘ HD', '#b45309', '#451a03', '#fde68a'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv5tnb/playlist_360p.m3u8',
    fallbackUrl: 'https://live.canthotv.vn/live/tv/master.m3u8',
    backupUrls: [],
    description: 'Kênh Truyền hình VTV5 Tây Nam Bộ HD',
  },
  {
    id: 'iptv_vtv5taynguyen',
    name: 'VTV5 Tây Nguyên HD',
    group: 'vtv',
    groupLabel: 'Đài VTV',
    poster: createChannelLogoSvgDataUri('VTV5 TN', 'TÂY NGUYÊN HD', '#15803d', '#052e16', '#86efac'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv5tn/playlist_360p.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=110',
    backupUrls: [],
    description: 'Kênh Truyền hình VTV5 Tây Nguyên HD',
  },

  // ==================== 2. KÊNH QUỐC TẾ & PHIM BOM TẤN (AURAFLIX CLEARKEY + HLS) ====================
  {
    id: 'iptv_hbo',
    name: 'HBO HD (Vietsub)',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('HBO HD', 'PHIM BOM TẤN', '#111827', '#030712', '#F5C518'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/hbo.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '09ddfe3d63863cafaeb79d0546b098ab',
    keyHex: '3de0f38dcf014827dfd5bec38743c6a2',
    description: 'Kênh phim bom tấn Hollywood HBO HD phụ đề Tiếng Việt',
  },
  {
    id: 'iptv_warnertv',
    name: 'Warner TV HD (Vietsub)',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('WARNER TV', 'HOLLYWOOD HD', '#1e3a8a', '#0f172a', '#fde047'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/wtv.smil/manifest.mpd',
    fallbackUrl: 'http://cdn4.skygo.mn/live/disk1/Warner/HLSv3-FTA/Warner.m3u8',
    isClearkey: true,
    kidHex: '086d09a40bff3a00aa6dd4dbaf9c13b2',
    keyHex: '34f1908cfe2e05ee060046d40f14aec9',
    description: 'Kênh phim điện ảnh & series bom tấn Warner Bros. HD',
  },
  {
    id: 'iptv_cinemax',
    name: 'Cinemax HD (Vietsub)',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CINEMAX', 'ACTION MOVIES', '#991b1b', '#1f2937', '#fca5a5'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/max.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'acb4c23471063327adc732e283c0847f',
    keyHex: 'e9868f5f473d0fd8699ede48d531c2b0',
    description: 'Kênh phim hành động Hollywood Cinemax HD Vietsub',
  },
  {
    id: 'iptv_axn',
    name: 'AXN HD (Vietsub)',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('AXN HD', 'ACTION SERIES', '#dc2626', '#450a0a', '#fef08a'),
    streamUrl: 'https://s7771.cdn.mytvnet.vn/pkg20/live_dzones/axn.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '9d29f87efdec3c9fab368f724a62ad0e',
    keyHex: '6f1c09c035eab36323d60d1454db3d20',
    description: 'Kênh giải trí & phim hành động quốc tế AXN HD',
  },
  {
    id: 'iptv_cinemaworld',
    name: 'CinemaWorld HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CINEMAWORLD', 'WORLD MOVIES', '#4f46e5', '#1e1b4b', '#c7d2fe'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/cinemaworld.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'ee7915564d7439d09bd3556ffccc87a4',
    keyHex: 'b35e12a75a42a6f9184723a90ff42d9c',
    description: 'Kênh phim điện ảnh quốc tế đạt giải thưởng CinemaWorld HD',
  },
  {
    id: 'iptv_cartoon',
    name: 'Cartoon Network HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CARTOON NET', 'HOẠT HÌNH HD', '#0284c7', '#082f49', '#fde047'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/cn.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '3c20166660a93a75ac77db81567389f7',
    keyHex: '3cc1add43aecce3fe31c9c6a2a5b8c21',
    description: 'Kênh hoạt hình quốc tế Cartoon Network HD',
  },
  {
    id: 'iptv_dreamworks',
    name: 'DreamWorks HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('DREAMWORKS', 'ANIMATION HD', '#1d4ed8', '#172554', '#93c5fd'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/dreamwork.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '67dae20527c63dadaaae609aa91577cb',
    keyHex: '59328f621d56767bc5ff9404a8940683',
    description: 'Kênh hoạt hình 3D bom tấn DreamWorks Animation HD',
  },
  {
    id: 'iptv_boomerang',
    name: 'Cartoonito / Boomerang HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('BOOMERANG', 'CARTOONITO HD', '#7c3aed', '#2e1065', '#f9a8d4'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/boomerang.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'b1f0d759e914369db388b3b0dc815971',
    keyHex: '5678d317e17007a88a9b9539e4526512',
    description: 'Kênh hoạt hình Tom & Jerry, Scooby-Doo Boomerang HD',
  },
  {
    id: 'iptv_discovery',
    name: 'Discovery Channel HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('DISCOVERY', 'KHÁM PHÁ THẾ GIỚI', '#0369a1', '#082f49', '#38bdf8'),
    streamUrl: 'https://s7770.cdn.mytvnet.vn/pkg20/live_dzones/dsc.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'eb4160ea553a321d899553e4e796fec2',
    keyHex: 'bea5a07157e0c4d17b11ab399517f952',
    description: 'Kênh khoa học & khám phá thiên nhiên Discovery Channel HD',
  },
  {
    id: 'iptv_discoveryasia',
    name: 'Discovery Asia HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('DISCOVERY ASIA', 'KHÁM PHÁ CHÂU Á', '#0f766e', '#042f2e', '#5eead4'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/dscasia.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '934907b134be3963a6263a453846924c',
    keyHex: '788e2835fb98568aed2f47bbdc091515',
    description: 'Kênh tài liệu văn hóa & thiên nhiên Châu Á Discovery Asia HD',
  },
  {
    id: 'iptv_animalplanet',
    name: 'Animal Planet HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('ANIMAL PLANET', 'THẾ GIỚI ĐỘNG VẬT', '#15803d', '#052e16', '#86efac'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/ap.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'ec6f072c7125377a9bc0ae61598095f4',
    keyHex: '1d5388e0781415ebcec9914f5ad75875',
    description: 'Kênh thế giới động vật hoang dã Animal Planet HD',
  },
  {
    id: 'iptv_bbcearth',
    name: 'BBC Earth HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('BBC EARTH', 'THIÊN NHIÊN 4K', '#047857', '#064e3b', '#6ee7b7'),
    streamUrl: 'https://s7771.cdn.mytvnet.vn/pkg20/live_dzones/bbcearth.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '5014941a2c42379880b5edf72304c165',
    keyHex: 'f3fa0fe3cd39a52f4eefd36ff7161e89',
    description: 'Kênh phim tài liệu thiên nhiên BBC Earth HD',
  },
  {
    id: 'iptv_bbclifestyle',
    name: 'BBC Lifestyle HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('BBC LIFESTYLE', 'PHONG CÁCH SỐNG', '#be185d', '#500724', '#f472b6'),
    streamUrl: 'https://s7770.cdn.mytvnet.vn/pkg20/live_dzones/bbclifestyle.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '58b949986ed13294bc01b0f330abc527',
    keyHex: '23e8c5f2fe202906ac2d6554d9527299',
    description: 'Kênh ẩm thực, du lịch & phong cách sống BBC Lifestyle HD',
  },
  {
    id: 'iptv_cbeebies',
    name: 'BBC CBeebies HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CBEEBIES', 'THIẾU NHI BBC', '#ca8a04', '#422006', '#fef08a'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/cbb.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'cca73a006b4b39a595207ceb5ed9ca0a',
    keyHex: 'b833d1f40c261ef78896f97e06f80cdc',
    description: 'Kênh thiếu nhi giáo dục tiếng Anh BBC CBeebies HD',
  },
  {
    id: 'iptv_dmax',
    name: 'DMAX HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('DMAX HD', 'PHIÊU LƯU TỐC ĐỘ', '#c2410c', '#431407', '#fdba74'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/dmax.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '53b26f904ae03a20b56477cfb9c5dca2',
    keyHex: '0c64ccfb978e7390bd33344075492aec',
    description: 'Kênh khám phá ô tô, sinh tồn & phiêu lưu DMAX HD',
  },
  {
    id: 'iptv_tlc',
    name: 'TLC (Travel & Living) HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('TLC HD', 'TRAVEL & LIVING', '#db2777', '#500724', '#fbcfe8'),
    streamUrl: 'https://s129135.cdn.mytvnet.vn/pkg20/live_dzones/tlc.smil/manifest.mpd',
    isClearkey: true,
    kidHex: 'b6908629732639ada4814a6208296d9c',
    keyHex: '7ca9bf03623f77b5e2f16df0b53f274d',
    description: 'Kênh du lịch, ẩm thực & văn hóa thế giới TLC HD',
  },
  {
    id: 'iptv_fashiontv',
    name: 'Fashion TV HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('FASHION TV', 'THỜI TRANG QUỐC TẾ', '#312e81', '#090d16', '#f9a8d4'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/ftv.smil/manifest.mpd',
    fallbackUrl: 'https://stream8.cinerama.uz/1053/tracks-v1a1/mono.m3u8',
    isClearkey: true,
    kidHex: 'c1d9f25701023508bfa6737e3a8c7001',
    keyHex: '30c3613e9b06e0f7cc201014f31bf5d8',
    description: 'Kênh thời trang & sàn diễn quốc tế Fashion TV HD',
  },
  {
    id: 'iptv_bbcworldnews',
    name: 'BBC News HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('BBC NEWS', 'WORLD NEWS HD', '#991b1b', '#450a0a', '#fca5a5'),
    streamUrl: 'https://s7771.cdn.mytvnet.vn/pkg20/live_dzones/bbcworldnews.smil/manifest.mpd',
    fallbackUrl: 'https://mumbai-edge.smartplaytv.in/BBCNews/index.m3u8',
    isClearkey: true,
    kidHex: 'c7ba46086dda345a929e29bf155e459c',
    keyHex: 'd374b8f39904bf572689ea347ae86591',
    description: 'Kênh tin tức thời sự thế giới 24/7 BBC News HD',
  },
  {
    id: 'iptv_cnn',
    name: 'CNN International HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CNN HD', 'BREAKING NEWS', '#b91c1c', '#450a0a', '#ffffff'),
    streamUrl: 'https://s7771.cdn.mytvnet.vn/pkg20/live_dzones/cnn.smil/manifest.mpd',
    fallbackUrl:
      'https://d3bp6dwmpbdajl.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-ury0meh5m4nzm/index.m3u8',
    isClearkey: true,
    kidHex: '714cc8ed05a03abb9ac61bd4bbd1d8a0',
    keyHex: '1acf58ff8d4cd87c2d3c12d22248efb1',
    description: 'Kênh tin tức toàn cầu CNN International HD',
  },
  {
    id: 'iptv_bloomberg',
    name: 'Bloomberg TV HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('BLOOMBERG', 'FINANCE & TECH', '#1e1b4b', '#090d16', '#38bdf8'),
    streamUrl: 'https://s2129134.cdn.mytvnet.vn/pkg20/live_dzones/bloomberg.smil/manifest.mpd',
    isClearkey: true,
    kidHex: '1071393f8fc237f3a9a28028142110f7',
    keyHex: '7a0f8c3c72e0ffff811d534c929c57c2',
    description: 'Kênh tài chính, chứng khoán & kinh tế toàn cầu Bloomberg TV HD',
  },
  {
    id: 'iptv_france24',
    name: 'France 24 English HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('FRANCE 24', 'INTERNATIONAL HD', '#0284c7', '#0c4a6e', '#7dd3fc'),
    streamUrl: 'https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_5000.m3u8',
    fallbackUrl: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    description: 'Tin tức thế giới, văn hóa Châu Âu & thể thao quốc tế 24/7',
  },
  {
    id: 'iptv_dw',
    name: 'DW (Deutsche Welle) HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('DW NEWS', 'GERMANY HD', '#1d4ed8', '#172554', '#93c5fd'),
    streamUrl: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    fallbackUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    description: 'Kênh tin tức, khoa học & khám phá Đức DW English HD',
  },
  {
    id: 'iptv_aljazeera',
    name: 'Al Jazeera English HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('AL JAZEERA', 'GLOBAL NEWS HD', '#b45309', '#451a03', '#fde047'),
    streamUrl: 'https://live-hls-web-aje-gcp.thehlive.com/AJE/01.m3u8',
    fallbackUrl: 'https://live-hls-apps-aje-fa.getaj.net/AJE/01.m3u8',
    description: 'Kênh tin tức & phóng sự quốc tế Al Jazeera English HD',
  },
  {
    id: 'iptv_trtworld',
    name: 'TRT World FHD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('TRT WORLD', 'GLOBAL NEWS FHD', '#0f766e', '#042f2e', '#5eead4'),
    streamUrl: 'https://tv-trtworld.medya.trt.com.tr/master_1080.m3u8',
    fallbackUrl: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    description: 'Kênh thời sự và tài liệu quốc tế TRT World 1080p',
  },
  {
    id: 'iptv_ebskids',
    name: 'EBS Kids TV HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('EBS KIDS', 'KOREA KIDS HD', '#16a34a', '#052e16', '#fde047'),
    streamUrl: 'https://ebsonairios.ebs.co.kr/ebsutablet500k/tablet500k/playlist.m3u8',
    fallbackUrl: 'https://ebsonair.ebs.co.kr/ebsufamilypc/familypc1m/playlist.m3u8',
    description: 'Kênh thiếu nhi & hoạt hình giáo dục Hàn Quốc EBS Kids HD',
  },
  {
    id: 'iptv_cna',
    name: 'CNA Singapore HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('CNA ASIA', 'SINGAPORE HD', '#b91c1c', '#450a0a', '#fca5a5'),
    streamUrl: 'https://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a48ec97f66ebbe/index.m3u8',
    fallbackUrl: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    description: 'Kênh tin tức Châu Á phát sóng từ Singapore CNA HD',
  },
  {
    id: 'iptv_arirang',
    name: 'Arirang Korea HD',
    group: 'intl',
    groupLabel: 'Kênh Quốc Tế',
    poster: createChannelLogoSvgDataUri('ARIRANG', 'KOREA TV HD', '#be123c', '#4c0519', '#fda4af'),
    streamUrl: 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
    fallbackUrl: 'https://d2e1asnsl7br7b.cloudfront.net/7782e205e72f43aeb4a48ec97f66ebbe/index.m3u8',
    description: 'Kênh giải trí K-Pop, phim truyện & văn hóa Hàn Quốc Arirang HD',
  },

  // ==================== 3. BÓNG ĐÁ & THỂ THAO ====================
  {
    id: 'iptv_htvthethao',
    name: 'HTV Thể Thao HD • Trực Tiếp Bóng Đá',
    group: 'sports',
    groupLabel: '⚽ Bóng Đá & Thể Thao',
    poster: createChannelLogoSvgDataUri('HTV SPORT', 'BÓNG ĐÁ & THỂ THAO', '#15803d', '#052e16', '#4ade80'),
    streamUrl: 'https://vmttv.dpdns.org/tv360/?id=htv-the-thao',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=193',
    backupUrls: ['https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'],
    description: 'Trực tiếp Bóng đá Việt Nam, V-League, Cúp Quốc Gia, Đua xe Cúp Truyền Hình',
  },
  {
    id: 'iptv_ongolf',
    name: 'ON Sports / Golf HD • VTVcab 23',
    group: 'sports',
    groupLabel: '⚽ Bóng Đá & Thể Thao',
    poster: createChannelLogoSvgDataUri('ON SPORTS', 'VTVCAB THỂ THAO', '#1d4ed8', '#172554', '#60a5fa'),
    streamUrl: 'https://vmttv.dpdns.org/tv360/?id=vtvcab-23-golf-channel',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=htv-the-thao',
    backupUrls: ['https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8'],
    description: 'Kênh Thể thao & Golf chuyên biệt VTVcab ON Sports HD',
  },
  {
    id: 'iptv_redbull_sports',
    name: 'Red Bull Sports 4K • Đua Xe & Extreme',
    group: 'sports',
    groupLabel: '⚽ Bóng Đá & Thể Thao',
    poster: createChannelLogoSvgDataUri('RED BULL TV', 'EXTREME SPORTS 4K', '#b91c1c', '#1e1b4b', '#facc15'),
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    fallbackUrl: 'https://vmttv.dpdns.org/tv360/?id=htv-the-thao',
    backupUrls: [],
    description: 'Trực tiếp Thể thao tốc độ F1, Rally, MotoGP & Extreme Sports 4K',
  },

  // ==================== 4. ĐÀI HTV • GIẢI TRÍ TP.HCM ====================
  {
    id: 'iptv_htv7',
    name: 'HTV7 HD • Giải Trí & Phim Việt',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV7 HD', 'GIẢI TRÍ TP.HCM', '#0284c7', '#082f49', '#38bdf8'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=193',
    fallbackUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv9/playlist_360p.m3u8',
    backupUrls: [],
    description: 'Kênh Giải trí tổng hợp & Gameshow ăn khách nhất miền Nam HTV7 HD',
  },
  {
    id: 'iptv_htv9',
    name: 'HTV9 HD • Thời Sự TP.HCM',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV9 HD', 'THỜI SỰ TP.HCM', '#0369a1', '#0c4a6e', '#7dd3fc'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=194',
    fallbackUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/vtv9/playlist_360p.m3u8',
    backupUrls: [],
    description: 'Kênh Thời sự - Chính trị - Văn hóa Đài Truyền hình TP.HCM HTV9 HD',
  },
  {
    id: 'iptv_htv2',
    name: 'HTV2 HD • Vie Channel',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV2 VIE', 'VIE CHANNEL HD', '#db2777', '#500724', '#f472b6'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=191',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=180',
    backupUrls: [],
    description: 'Siêu phẩm Rap Việt, Anh Trai Say Hi, 2 Ngày 1 Đêm & Phim bom tấn HTV2',
  },
  {
    id: 'iptv_htv3',
    name: 'HTV3 HD • DreamsTV',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV3', 'DREAMSTV HD', '#7c3aed', '#3b0764', '#c4b5fd'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=192',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=178',
    backupUrls: [],
    description: 'Kênh phim hoạt hình Anime lồng tiếng & Gia đình HTV3 HD',
  },
  {
    id: 'iptv_htv1',
    name: 'HTV1 • Thông Tin Kinh Tế',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV1', 'THÔNG TIN CÔNG CỘNG', '#2563eb', '#172554', '#93c5fd'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=190',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=193',
    backupUrls: [],
    description: 'Kênh Thông tin Kinh tế - Xã hội TP.HCM HTV1',
  },
  {
    id: 'iptv_htv4',
    name: 'HTV Key (HTV4) • Khoa Học & Giáo Dục',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV KEY', 'HTV4 GIÁO DỤC', '#0d9488', '#134e4a', '#5eead4'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=9',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=190',
    backupUrls: [],
    description: 'Kênh Học tập, Kỹ năng & Khoa học đời sống HTV Key (HTV4)',
  },
  {
    id: 'iptv_htv5',
    name: 'HTV5 • B Channel',
    group: 'htv',
    groupLabel: 'HTV • Giải Trí',
    poster: createChannelLogoSvgDataUri('HTV5', 'B CHANNEL HD', '#b45309', '#451a03', '#fde047'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=151',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=190',
    backupUrls: [],
    description: 'Kênh Văn hóa Phương Đông & Đời sống HTV5 - B Channel',
  },

  // ==================== 5. VTVCAB • ON TV & SCTV ====================
  {
    id: 'iptv_onviegiaitri',
    name: 'ON Vie Giải Trí • VTVcab 1',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON GIẢI TRÍ', 'VTVCAB 1 HD', '#d97706', '#451a03', '#fcd34d'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=180',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=180',
    backupUrls: [],
    description: 'Kênh giải trí tổng hợp và phim truyện đặc sắc VTVcab 1 - ON Vie Giải Trí',
  },
  {
    id: 'iptv_onviedramas',
    name: 'ON Vie Dramas • VTVcab 19',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON DRAMAS', 'VTVCAB 19 HD', '#db2777', '#500724', '#f472b6'),
    streamUrl: 'http://dvrfl05.bozztv.com/vch_vchannel18/tracks-v1a1/mono.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=177',
    backupUrls: [],
    description: 'Kênh phim truyện Châu Á & Hàn Quốc đặc sắc VTVcab 19 - ON Vie Dramas',
  },
  {
    id: 'iptv_onmovies',
    name: 'ON Movies • VTVcab 4',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON MOVIES', 'VTVCAB 4 HD', '#b91c1c', '#450a0a', '#fca5a5'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=181',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=181',
    backupUrls: [],
    description: 'Kênh phim điện ảnh quốc tế và Châu Á VTVcab 4 - ON Movies',
  },
  {
    id: 'iptv_oncine',
    name: 'ON Cine • VTVcab 7',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON CINE', 'VTVCAB 7 HD', '#7c3aed', '#2e1065', '#c4b5fd'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=176',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=176',
    backupUrls: [],
    description: 'Kênh điện ảnh & giải trí VTVcab 7 - ON Cine HD',
  },
  {
    id: 'iptv_onechannel',
    name: 'ON E Channel • VTVcab 5',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('E CHANNEL', 'VTVCAB 5 HD', '#ea580c', '#431407', '#fdba74'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=182',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=182',
    backupUrls: [],
    description: 'Kênh phim truyện & giải trí tổng hợp VTVcab 5 - ON E Channel',
  },
  {
    id: 'iptv_onbibi',
    name: 'ON BiBi • VTVcab 8 Thiếu Nhi',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON BIBI', 'THIẾU NHI VTVCAB 8', '#0284c7', '#082f49', '#fde047'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=178',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=178',
    backupUrls: [],
    description: 'Kênh phim hoạt hình và thiếu nhi VTVcab 8 - ON BiBi',
  },
  {
    id: 'iptv_onkids',
    name: 'ON Kids • VTVcab 21 Hoạt Hình',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON KIDS', 'HOẠT HÌNH VTVCAB', '#16a34a', '#052e16', '#86efac'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=179',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=179',
    backupUrls: [],
    description: 'Kênh thiếu nhi và hoạt hình giáo dục VTVcab 21 - ON Kids',
  },
  {
    id: 'iptv_onmusic',
    name: 'ON Music • VTVcab 15 Ca Nhạc',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON MUSIC', 'VTVCAB 15 HD', '#9333ea', '#3b0764', '#e9d5ff'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=185',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=185',
    backupUrls: [],
    description: 'Kênh âm nhạc Việt Nam và Quốc tế VTVcab 15 - ON Music',
  },
  {
    id: 'iptv_onstyletv',
    name: 'ON Style TV • VTVcab 12',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON STYLE', 'VTVCAB 12 HD', '#db2777', '#500724', '#fbcfe8'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=184',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=184',
    backupUrls: [],
    description: 'Kênh Phong cách sống & Thời trang VTVcab 12 - ON Style TV',
  },
  {
    id: 'iptv_onvfamily',
    name: 'ON VFamily • VTVcab 20',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('ON VFAMILY', 'VTVCAB 20 HD', '#d97706', '#451a03', '#fde68a'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=187',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=187',
    backupUrls: [],
    description: 'Kênh Gia đình Việt VTVcab 20 - ON VFamily',
  },
  {
    id: 'iptv_sctv2',
    name: 'SCTV2 • TodayTV HD',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('TODAY TV', 'SCTV2 HD', '#e11d48', '#4c0519', '#fda4af'),
    streamUrl: 'https://vtvgolive-sctvdrm.vtvdigital.vn/manifest/sctv2/master.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=201',
    backupUrls: [],
    description: 'Kênh phim truyện & giải trí tổng hợp SCTV2 - TodayTV HD',
  },
  {
    id: 'iptv_sctv4',
    name: 'SCTV4 • Giải Trí Tổng Hợp',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('SCTV4', 'GIẢI TRÍ SCTV', '#0284c7', '#082f49', '#7dd3fc'),
    streamUrl: 'https://vmttv.dpdns.org/VTVGo/?sctv4',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=232',
    backupUrls: [],
    description: 'Kênh truyền hình giải trí tổng hợp SCTV4 HD',
  },
  {
    id: 'iptv_sctv6',
    name: 'SCTV6 • FIM360 Phim Đặc Sắc',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('SCTV6', 'FIM360 PHIM HD', '#ca8a04', '#422006', '#fef08a'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=232',
    fallbackUrl: 'https://vmttv.dpdns.org/VTVGo/?sctvphim',
    backupUrls: [],
    description: 'Kênh phim bom tấn Châu Á & Hoa ngữ SCTV6 - FIM360 HD',
  },
  {
    id: 'iptv_sctv9',
    name: 'SCTV9 • Phim Châu Á & TVB',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('SCTV9', 'PHIM CHÂU Á TVB', '#1d4ed8', '#172554', '#93c5fd'),
    streamUrl: 'https://vmttv.dpdns.org/VTVGo/?sctv9',
    fallbackUrl: 'https://vmttv.dpdns.org/VTVGo/?sctvphim',
    backupUrls: [],
    description: 'Kênh phim bộ TVB Hồng Kông và Châu Á SCTV9 HD',
  },
  {
    id: 'iptv_sctv16',
    name: 'SCTV16 • Phim Hành Động',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('SCTV16', 'PHIM HÀNH ĐỘNG', '#4338ca', '#1e1b4b', '#a5b4fc'),
    streamUrl: 'https://vmttv.dpdns.org/VTVGo/?sctv16',
    fallbackUrl: 'https://vmttv.dpdns.org/VTVGo/?sctvphim',
    backupUrls: [],
    description: 'Kênh phim truyện hành động đặc sắc nước ngoài SCTV16 HD',
  },
  {
    id: 'iptv_sctvphim',
    name: 'SCTV Phim Tổng Hợp HD',
    group: 'vtvcab',
    groupLabel: 'VTVcab • ON TV & SCTV',
    poster: createChannelLogoSvgDataUri('SCTV PHIM', 'PHIM TỔNG HỢP', '#be123c', '#4c0519', '#fda4af'),
    streamUrl: 'https://vmttv.dpdns.org/VTVGo/?sctvphim',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?id=232',
    backupUrls: [],
    description: 'Kênh phim truyện đặc sắc SCTV Phim Tổng Hợp HD',
  },

  // ==================== 6. THVL • VĨNH LONG & ĐỊA PHƯƠNG ====================
  {
    id: 'iptv_thvl1',
    name: 'THVL1 HD • Truyền Hình Vĩnh Long 1',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THVL1 HD', 'VĨNH LONG 1', '#d97706', '#451a03', '#fde047'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=25',
    fallbackUrl: 'https://live.canthotv.vn/live/tv/master.m3u8',
    backupUrls: [],
    description: 'Phim truyện Việt Nam giờ vàng, Gameshow & Thời sự Miền Tây THVL1 HD',
  },
  {
    id: 'iptv_thvl2',
    name: 'THVL2 HD • Truyền Hình Vĩnh Long 2',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THVL2 HD', 'VĨNH LONG 2', '#ea580c', '#431407', '#fdba74'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=26',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=25',
    backupUrls: [],
    description: 'Kênh Giải trí, Phim truyện nước ngoài & Thể thao THVL2 HD',
  },
  {
    id: 'iptv_thvl3',
    name: 'THVL3 HD • Phim Truyện Miền Tây',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THVL3 HD', 'VĨNH LONG 3', '#b45309', '#451a03', '#fcd34d'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=219',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=25',
    backupUrls: [],
    description: 'Kênh chuyên biệt Phim truyện Việt Nam & Châu Á THVL3 HD',
  },
  {
    id: 'iptv_thvl4',
    name: 'THVL4 HD • Văn Hóa & Du Lịch',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THVL4 HD', 'VĨNH LONG 4', '#0d9488', '#134e4a', '#5eead4'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=220',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=26',
    backupUrls: [],
    description: 'Kênh Văn hóa, Du lịch, Cải lương & Giải trí Miền Tây THVL4 HD',
  },
  {
    id: 'iptv_cantho',
    name: 'Cần Thơ TV (THTPCT) • Miền Tây',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('CẦN THƠ TV', 'THTPCT HD', '#0891b2', '#083344', '#67e8f9'),
    streamUrl: 'https://live.canthotv.vn/live/tv/master.m3u8',
    fallbackUrl: 'https://live.canthotv.vn/cs2/live.stream/chunklist_w1497265452.m3u8',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình TP. Cần Thơ HD',
  },
  {
    id: 'iptv_dongthap1',
    name: 'Đồng Tháp TV1 (THĐT1 HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('ĐỒNG THÁP 1', 'THĐT1 HD', '#db2777', '#500724', '#fbcfe8'),
    streamUrl: 'https://618b88f69e53b.streamlock.net/THDT/thdttv/playlist.m3u8',
    fallbackUrl: 'https://618b88f69e53b.streamlock.net/THDT2/thdttv2/chunklist.m3u8',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Đồng Tháp THĐT1 HD',
  },
  {
    id: 'iptv_dongthap2',
    name: 'Đồng Tháp TV2 (THĐT2 Miền Tây)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('ĐỒNG THÁP 2', 'MIỀN TÂY THĐT2', '#16a34a', '#052e16', '#86efac'),
    streamUrl: 'https://618b88f69e53b.streamlock.net/THDT2/thdttv2/chunklist.m3u8',
    fallbackUrl: 'https://618b88f69e53b.streamlock.net/THDT/thdttv/playlist.m3u8',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Đồng Tháp THĐT2 Miền Tây',
  },
  {
    id: 'iptv_haiphong',
    name: 'Hải Phòng TV (THP HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('HẢI PHÒNG', 'THP HD LIVE', '#0284c7', '#082f49', '#7dd3fc'),
    streamUrl:
      'https://live.mediatech.vn/live/285a4c99665fdf84e94956c66bc7dc7eb5d/playlist.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=59',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Hải Phòng THP HD',
  },
  {
    id: 'iptv_tayninh',
    name: 'Tây Ninh TV (TTV11 HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('TÂY NINH', 'TTV11 HD', '#059669', '#064e3b', '#6ee7b7'),
    streamUrl:
      'https://live.mediatech.vn/live/2851dc2c9af68834814a89e61db0faee561/playlist.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=72',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Tây Ninh TTV11 HD',
  },
  {
    id: 'iptv_thainguyen',
    name: 'Thái Nguyên TV (TN1 HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THÁI NGUYÊN', 'TN1 HD LIVE', '#4f46e5', '#1e1b4b', '#a5b4fc'),
    streamUrl: 'https://streaming.thainguyentv.vn/hls/livestream.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=88',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Thái Nguyên TN1 HD',
  },
  {
    id: 'iptv_laocai',
    name: 'Lào Cai TV (THLC HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('LÀO CAI TV', 'THLC HD', '#0d9488', '#134e4a', '#5eead4'),
    streamUrl: 'https://live.baolaocai.vn/channel2/stream.m3u8',
    fallbackUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=71',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Lào Cai THLC HD',
  },
  {
    id: 'iptv_thanhhoa',
    name: 'Thanh Hóa TV (TTV HD)',
    group: 'thvl',
    groupLabel: 'THVL • Địa Phương',
    poster: createChannelLogoSvgDataUri('THANH HÓA', 'TTV HD LIVE', '#b45309', '#451a03', '#fde047'),
    streamUrl: 'https://freem3u.xyz/api/live/play.m3u8?vid=89',
    fallbackUrl: 'https://streaming.thainguyentv.vn/hls/livestream.m3u8',
    backupUrls: [],
    description: 'Đài Phát thanh và Truyền hình Thanh Hóa TTV HD',
  },
];

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================
function normalizeKkphimPoster(rawUrl?: string, cdnDomain = 'https://phimimg.com'): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop';
  }
  const clean = rawUrl.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `${cdnDomain.replace(/\/+$/, '')}/${clean.replace(/^\/+/, '')}`;
}

function stripHtmlTags(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mapKkphimItemToCatalogMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  defaultType: 'movie' | 'series' = 'movie',
  cdnDomain = 'https://phimimg.com',
  idPrefix = 'phim_'
): CatalogMetaItem | null {
  if (!item || !item.slug) return null;
  const rawType = String(item.type || '').toLowerCase();
  const isSeries =
    rawType === 'series' ||
    rawType === 'hoathinh' ||
    rawType === 'tvshows' ||
    (item.episode_current &&
      !String(item.episode_current).toLowerCase().includes('full') &&
      String(item.episode_current).toLowerCase().includes('tập'));

  const poster = normalizeKkphimPoster(item.poster_url || item.thumb_url, cdnDomain);
  const background = normalizeKkphimPoster(item.thumb_url || item.poster_url, cdnDomain);
  const year = item.year ? String(item.year) : '';
  const epCur = item.episode_current ? String(item.episode_current) : 'HD';
  const quality = item.quality ? String(item.quality) : 'FHD';
  const lang = item.lang ? String(item.lang) : 'Vietsub';
  const tmdbVote = item.tmdb?.vote_average
    ? Number(item.tmdb.vote_average).toFixed(1)
    : undefined;

  const genres: string[] = Array.isArray(item.category)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item.category.map((c: any) => c?.name).filter(Boolean)
    : [];

  const tmdbId = item.tmdb?.id ? String(item.tmdb.id) : undefined;
  const imdbId = item.imdb?.id ? String(item.imdb.id) : undefined;

  return {
    id: `${idPrefix}${item.slug}`,
    type: isSeries ? 'series' : defaultType,
    name: item.name || item.origin_name || item.slug,
    originName: item.origin_name || '',
    poster,
    background,
    year,
    releaseInfo: year,
    episodeCurrent: epCur,
    quality,
    lang,
    tmdbVote,
    tmdbId,
    imdbId,
    genres,
    description: `${epCur} • ${quality} • ${lang}${year ? ` • ${year}` : ''}`,
  };
}

// ============================================================================
// CATALOG MAPPING & DIRECT FETCHING (SUPPORTS SOURCE FILTER)
// ============================================================================
const directCatalogCache = new Map<string, { ts: number; items: CatalogMetaItem[] }>();
const directDetailCache = new Map<string, { ts: number; detail: DirectMovieDetail }>();

function mapCatalogIdToKkphimPath(catalogId: string, page: number): string {
  const cleanId = catalogId.replace(/^cat_/, '').replace(/_/g, '-');

  if (cleanId === 'moi-cap-nhat' || cleanId === 'phim-moi-cap-nhat' || cleanId === 'top') {
    return `https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`;
  }
  if (cleanId === 'phim-le' || cleanId === 'phim-chieu-rap' || cleanId === 'phim-4k') {
    return `https://phimapi.com/v1/api/danh-sach/phim-le?page=${page}&limit=24`;
  }
  if (cleanId === 'phim-bo' || cleanId === 'bxh-phim-thang') {
    return `https://phimapi.com/v1/api/danh-sach/phim-bo?page=${page}&limit=24`;
  }
  if (
    cleanId === 'hoat-hinh' ||
    cleanId === 'hoat-hinh-anime' ||
    cleanId === 'phim-thieu-nhi'
  ) {
    return `https://phimapi.com/v1/api/danh-sach/hoat-hinh?page=${page}&limit=24`;
  }
  if (cleanId === 'tv-shows') {
    return `https://phimapi.com/v1/api/danh-sach/tv-shows?page=${page}&limit=24`;
  }
  if (cleanId === 'phim-le-thuyet-minh' || cleanId === 'thuyet-minh') {
    return `https://phimapi.com/v1/api/danh-sach/phim-thuyet-minh?page=${page}&limit=24`;
  }
  if (cleanId === 'long-tieng' || cleanId === 'vo-thuat-long-tieng') {
    return `https://phimapi.com/v1/api/danh-sach/phim-long-tieng?page=${page}&limit=24`;
  }
  if (cleanId.startsWith('quoc-gia-')) {
    const countrySlug = cleanId.replace('quoc-gia-', '');
    return `https://phimapi.com/v1/api/quoc-gia/${countrySlug}?page=${page}&limit=24`;
  }
  if (cleanId === 'han-quoc' || cleanId === 'trung-quoc' || cleanId === 'au-my' || cleanId === 'nhat-ban' || cleanId === 'thai-lan' || cleanId === 'viet-nam') {
    return `https://phimapi.com/v1/api/quoc-gia/${cleanId}?page=${page}&limit=24`;
  }
  if (cleanId === 'han-trung') {
    return `https://phimapi.com/v1/api/quoc-gia/trung-quoc?page=${page}&limit=24`;
  }
  if (cleanId.startsWith('the-loai-')) {
    const genreSlug = cleanId.replace('the-loai-', '');
    return `https://phimapi.com/v1/api/the-loai/${genreSlug}?page=${page}&limit=24`;
  }
  const knownGenres = [
    'hanh-dong',
    'tinh-cam',
    'hai-huoc',
    'co-trang',
    'tam-ly',
    'hinh-su',
    'chien-tranh',
    'the-thao',
    'vo-thuat',
    'vien-tuong',
    'khoa-hoc-vien-tuong',
    'phi-luu',
    'phieu-luu',
    'khoa-hoc',
    'kinh-di',
    'am-nhac',
    'than-thoai',
    'tai-lieu',
    'gia-dinh',
    'chinh-kich',
    'bi-an',
    'hoc-duong',
  ];
  if (knownGenres.includes(cleanId)) {
    const mappedGenre = cleanId === 'khoa-hoc-vien-tuong' ? 'vien-tuong' : cleanId;
    return `https://phimapi.com/v1/api/the-loai/${mappedGenre}?page=${page}&limit=24`;
  }

  return `https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`;
}

function mapCatalogIdToOphimPath(catalogId: string, page: number): string {
  const cleanId = catalogId.replace(/^cat_/, '').replace(/_/g, '-');
  if (cleanId === 'phim-le' || cleanId === 'phim-chieu-rap' || cleanId === 'phim-4k') {
    return `https://ophim1.com/v1/api/danh-sach/phim-le?page=${page}`;
  }
  if (cleanId === 'phim-bo' || cleanId === 'bxh-phim-thang') {
    return `https://ophim1.com/v1/api/danh-sach/phim-bo?page=${page}`;
  }
  if (cleanId === 'hoat-hinh' || cleanId === 'hoat-hinh-anime' || cleanId === 'phim-thieu-nhi') {
    return `https://ophim1.com/v1/api/danh-sach/hoat-hinh?page=${page}`;
  }
  if (cleanId.startsWith('quoc-gia-')) {
    return `https://ophim1.com/v1/api/quoc-gia/${cleanId.replace('quoc-gia-', '')}?page=${page}`;
  }
  if (cleanId.startsWith('the-loai-')) {
    return `https://ophim1.com/v1/api/the-loai/${cleanId.replace('the-loai-', '')}?page=${page}`;
  }
  return `https://ophim1.com/v1/api/danh-sach/phim-moi?page=${page}`;
}

function mapCatalogIdToNguonCPath(catalogId: string, page: number): string {
  const cleanId = catalogId.replace(/^cat_/, '').replace(/_/g, '-');
  if (cleanId === 'phim-le' || cleanId === 'phim-chieu-rap') {
    return `https://phim.nguonc.com/api/films/danh-sach/phim-le?page=${page}`;
  }
  if (cleanId === 'phim-bo' || cleanId === 'bxh-phim-thang') {
    return `https://phim.nguonc.com/api/films/danh-sach/phim-bo?page=${page}`;
  }
  if (cleanId === 'hoat-hinh' || cleanId === 'hoat-hinh-anime') {
    return `https://phim.nguonc.com/api/films/danh-sach/hoat-hinh?page=${page}`;
  }
  if (cleanId.startsWith('quoc-gia-')) {
    return `https://phim.nguonc.com/api/films/quoc-gia/${cleanId.replace('quoc-gia-', '')}?page=${page}`;
  }
  if (cleanId.startsWith('the-loai-')) {
    return `https://phim.nguonc.com/api/films/the-loai/${cleanId.replace('the-loai-', '')}?page=${page}`;
  }
  return `https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}`;
}

export async function fetchDirectCatalog(
  type: 'movie' | 'series' | 'tv',
  catalogId: string,
  options?: { page?: number; search?: string; source?: MovieSourceProvider }
): Promise<{ metas: CatalogMetaItem[]; pagination: { totalPages: number } }> {
  const page = Math.max(1, options?.page || 1);
  const search = (options?.search || '').trim();
  const source = options?.source || getPreferredMovieSource();

  // 1. Live TV Catalog
  if (type === 'tv' || catalogId.startsWith('tv_') || catalogId === 'sports_live_matches') {
    let filtered = DIRECT_LIVE_TV_CHANNELS;
    if (catalogId === 'tv_vtv') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'vtv');
    } else if (catalogId === 'tv_quoc_te') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'intl');
    } else if (catalogId === 'sports_live_matches') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'sports');
    } else if (catalogId === 'tv_vtvcab') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'vtvcab');
    } else if (catalogId === 'tv_giai_tri') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'htv' || c.group === 'vtvcab');
    } else if (catalogId === 'tv_dia_phuong') {
      filtered = DIRECT_LIVE_TV_CHANNELS.filter((c) => c.group === 'thvl');
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = DIRECT_LIVE_TV_CHANNELS.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.groupLabel.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    const metas: CatalogMetaItem[] = filtered.map((ch) => ({
      id: ch.id,
      type: 'tv',
      name: ch.name,
      poster: ch.poster,
      background: ch.poster,
      description: ch.description,
      quality: 'LIVE HD',
      lang: ch.groupLabel,
      episodeCurrent: '🔴 LIVE',
    }));

    return { metas, pagination: { totalPages: 1 } };
  }

  const cacheKey = `${source}_${type}_${catalogId}_p${page}_q${search}`;
  const cached = directCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000 && cached.items.length > 0) {
    return { metas: cached.items, pagination: { totalPages: 500 } };
  }

  // Helper to fetch from KKPhim
  const fetchKk = async (): Promise<CatalogMetaItem[]> => {
    try {
      const url = search
        ? `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(search)}&limit=24`
        : mapCatalogIdToKkphimPath(catalogId, page);
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const rawItems = data?.data?.items || data?.items || [];
      const cdn = data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://phimimg.com';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawItems.map((it: any) => mapKkphimItemToCatalogMeta(it, type, cdn, 'phim_')).filter(Boolean) as CatalogMetaItem[];
    } catch {
      return [];
    }
  };

  // Helper to fetch from OPhim
  const fetchOp = async (): Promise<CatalogMetaItem[]> => {
    try {
      const url = search
        ? `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(search)}`
        : mapCatalogIdToOphimPath(catalogId, page);
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const rawItems = data?.data?.items || [];
      const cdn = data?.data?.APP_DOMAIN_CDN_IMAGE || 'https://img.ophim.live/uploads/movies';
      return rawItems
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => {
          const thumb = it.thumb_url || it.poster_url || '';
          const fullPoster = thumb.startsWith('http')
            ? thumb
            : `${cdn.replace(/\/+$/, '')}/${thumb.replace(/^\/+/, '')}`;
          return mapKkphimItemToCatalogMeta(
            { ...it, poster_url: fullPoster, thumb_url: fullPoster },
            type,
            cdn,
            'ophim_'
          );
        })
        .filter(Boolean) as CatalogMetaItem[];
    } catch {
      return [];
    }
  };

  // Helper to fetch from NguonC
  const fetchNc = async (): Promise<CatalogMetaItem[]> => {
    try {
      const url = search
        ? `https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(search)}`
        : mapCatalogIdToNguonCPath(catalogId, page);
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const rawItems = data?.items || [];
      return rawItems
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => {
          if (!it || !it.slug) return null;
          return {
            id: `nguonc_${it.slug}`,
            type: String(it.total_episodes) === '1' ? 'movie' : 'series',
            name: it.name || it.original_name || it.slug,
            originName: it.original_name || '',
            poster: it.thumb_url || it.poster_url || '',
            background: it.poster_url || it.thumb_url || '',
            episodeCurrent: it.current_episode || 'HD',
            quality: it.quality || 'FHD',
            lang: it.language || 'Vietsub',
            description: stripHtmlTags(it.description || ''),
          } as CatalogMetaItem;
        })
        .filter(Boolean) as CatalogMetaItem[];
    } catch {
      return [];
    }
  };

  let results: CatalogMetaItem[] = [];

  if (source === 'kkphim') {
    results = await fetchKk();
    if (results.length === 0) results = await fetchOp();
  } else if (source === 'ophim') {
    results = await fetchOp();
    if (results.length === 0) results = await fetchKk();
  } else if (source === 'nguonc') {
    results = await fetchNc();
    if (results.length === 0) results = await fetchKk();
  } else {
    // 'all': fetch KKPhim first (fastest) or merge on search
    if (search) {
      const [kk, op, nc] = await Promise.all([fetchKk(), fetchOp(), fetchNc()]);
      const seen = new Set<string>();
      for (const item of [...kk, ...op, ...nc]) {
        const cleanSlug = item.id.replace(/^(phim_|ophim_|nguonc_)/, '');
        if (!seen.has(cleanSlug)) {
          seen.add(cleanSlug);
          results.push(item);
        }
      }
    } else {
      results = await fetchKk();
      if (results.length === 0) {
        results = await fetchOp();
      }
      if (results.length === 0) {
        results = await fetchNc();
      }
    }
  }

  if (results.length > 0) {
    directCatalogCache.set(cacheKey, { ts: Date.now(), items: results });
  }

  return { metas: results, pagination: { totalPages: 500 } };
}

// ============================================================================
// MULTI-SOURCE MOVIE DETAIL & EPISODE / SERVER AGGREGATOR
// Fetches from KKPhim + OPhim + NguonC in parallel so the user always has
// ALL servers (KKPhim Vietsub/Thuyết Minh, OPhim, NguonC) & links to choose from!
// ============================================================================
export async function fetchDirectMovieDetail(rawId: string): Promise<DirectMovieDetail | null> {
  const cleanSlug = rawId
    .replace(/^(phim_|ophim_|nguonc_|vsmov_|xink_)/i, '')
    .split(':')[0]
    .trim();

  if (!cleanSlug) return null;

  const cached = directDetailCache.get(cleanSlug);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.detail;
  }

  // Fetch all sources (KKPhim, OPhim, NguonC, Xinkpro, VSMov) in parallel
  const [kkRes, opRes, ncRes, xkRes, vsRes] = await Promise.allSettled([
    fetch(`https://phimapi.com/phim/${encodeURIComponent(cleanSlug)}`).then((r) =>
      r.ok ? r.json() : null
    ),
    fetch(`https://ophim1.com/phim/${encodeURIComponent(cleanSlug)}`).then((r) =>
      r.ok ? r.json() : null
    ),
    fetch(`https://phim.nguonc.com/api/film/${encodeURIComponent(cleanSlug)}`).then((r) =>
      r.ok ? r.json() : null
    ),
    fetch(`https://api.xink.pro/api/phim/${encodeURIComponent(cleanSlug)}`).then((r) =>
      r.ok ? r.json() : null
    ),
    fetch(`https://vsmov.com/api/phim/${encodeURIComponent(cleanSlug)}`).then((r) =>
      r.ok ? r.json() : null
    ),
  ]);

  const kkData = kkRes.status === 'fulfilled' ? kkRes.value : null;
  const opData = opRes.status === 'fulfilled' ? opRes.value : null;
  const ncData = ncRes.status === 'fulfilled' ? ncRes.value : null;
  const xkData = xkRes.status === 'fulfilled' ? xkRes.value : null;
  const vsData = vsRes.status === 'fulfilled' ? vsRes.value : null;

  const allServers: Array<{
    serverName: string;
    sourceProvider?: string;
    episodes: DirectEpisodeItem[];
  }> = [];

  // 1. Parse KKPhim servers
  if (kkData?.movie) {
    const rawEpisodes = Array.isArray(kkData.episodes) ? kkData.episodes : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawEpisodes.forEach((srv: any, sIdx: number) => {
      const rawSrvName = srv?.server_name || `VIP #${sIdx + 1}`;
      const serverName = rawSrvName.includes('KKPhim')
        ? rawSrvName
        : `🇻🇳 [KKPhim] ${rawSrvName}`;
      const serverData = Array.isArray(srv?.server_data) ? srv.server_data : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: DirectEpisodeItem[] = serverData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ep: any, idx: number) => {
          const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
          const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
          return {
            id: `phim_${cleanSlug}:${epNum}`,
            name: ep?.name || `Tập ${idx + 1}`,
            slug: ep?.slug || `${idx + 1}`,
            episodeNumber: epNum,
            linkM3u8: ep?.link_m3u8 || '',
            linkEmbed: ep?.link_embed || '',
            serverName,
            sourceProvider: 'KKPhim',
          };
        })
        .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));
      if (eps.length > 0) {
        allServers.push({ serverName, sourceProvider: 'KKPhim', episodes: eps });
      }
    });
  }

  // 2. Parse OPhim servers
  if (opData?.movie) {
    const rawEpisodes = Array.isArray(opData.episodes) ? opData.episodes : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawEpisodes.forEach((srv: any, sIdx: number) => {
      const rawSrvName = srv?.server_name || `OPhim #${sIdx + 1}`;
      const serverName = rawSrvName.includes('OPhim')
        ? rawSrvName
        : `⚡ [OPhim] ${rawSrvName}`;
      const serverData = Array.isArray(srv?.server_data) ? srv.server_data : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: DirectEpisodeItem[] = serverData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ep: any, idx: number) => {
          const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
          const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
          return {
            id: `ophim_${cleanSlug}:${epNum}`,
            name: ep?.name || `Tập ${idx + 1}`,
            slug: ep?.slug || `${idx + 1}`,
            episodeNumber: epNum,
            linkM3u8: ep?.link_m3u8 || '',
            linkEmbed: ep?.link_embed || '',
            serverName,
            sourceProvider: 'OPhim',
          };
        })
        .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));
      if (eps.length > 0) {
        allServers.push({ serverName, sourceProvider: 'OPhim', episodes: eps });
      }
    });
  }

  // 3. Parse NguonC servers
  if (ncData?.movie) {
    const rawEpisodes = Array.isArray(ncData.movie.episodes) ? ncData.movie.episodes : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawEpisodes.forEach((srv: any, sIdx: number) => {
      const rawSrvName = srv?.server_name || `NguonC #${sIdx + 1}`;
      const serverName = rawSrvName.includes('NguonC')
        ? rawSrvName
        : `🎬 [NguonC] ${rawSrvName}`;
      const items = Array.isArray(srv?.items) ? srv.items : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: DirectEpisodeItem[] = items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ep: any, idx: number) => {
          const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
          const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
          return {
            id: `nguonc_${cleanSlug}:${epNum}`,
            name: ep?.name ? `Tập ${ep.name}` : `Tập ${idx + 1}`,
            slug: ep?.slug || `${idx + 1}`,
            episodeNumber: epNum,
            linkM3u8: ep?.m3u8 || '',
            linkEmbed: ep?.embed || '',
            serverName,
            sourceProvider: 'NguonC',
          };
        })
        .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));
      if (eps.length > 0) {
        allServers.push({ serverName, sourceProvider: 'NguonC', episodes: eps });
      }
    });
  }

  // 4. Parse Xinkpro servers (https://api.xink.pro)
  if (xkData?.movie) {
    const rawEpisodes = Array.isArray(xkData.episodes) ? xkData.episodes : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawEpisodes.forEach((srv: any, sIdx: number) => {
      const rawSrvName = srv?.server_name || `XinkPro #${sIdx + 1}`;
      const serverName = `⚡ [XinkPro OnFlix] ${rawSrvName}`;
      const serverData = Array.isArray(srv?.server_data) ? srv.server_data : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: DirectEpisodeItem[] = serverData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ep: any, idx: number) => {
          const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
          const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
          return {
            id: `xink_${cleanSlug}:${epNum}`,
            name: ep?.name || `Tập ${idx + 1}`,
            slug: ep?.slug || `${idx + 1}`,
            episodeNumber: epNum,
            linkM3u8: ep?.link_m3u8 || ep?.m3u8 || '',
            linkEmbed: ep?.link_embed || '',
            serverName,
            sourceProvider: 'XinkPro',
          };
        })
        .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));
      if (eps.length > 0) {
        allServers.push({ serverName, sourceProvider: 'XinkPro', episodes: eps });
      }
    });
  }

  // 5. Parse VSMov servers
  if (vsData?.movie) {
    const rawEpisodes = Array.isArray(vsData.episodes) ? vsData.episodes : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawEpisodes.forEach((srv: any, sIdx: number) => {
      const rawSrvName = srv?.server_name || `VSMov #${sIdx + 1}`;
      const serverName = `🎬 [VSMov CDN] ${rawSrvName}`;
      const serverData = Array.isArray(srv?.server_data) ? srv.server_data : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: DirectEpisodeItem[] = serverData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ep: any, idx: number) => {
          const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
          const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
          return {
            id: `vsmov_${cleanSlug}:${epNum}`,
            name: ep?.name || `Tập ${idx + 1}`,
            slug: ep?.slug || `${idx + 1}`,
            episodeNumber: epNum,
            linkM3u8: ep?.link_m3u8 || ep?.m3u8 || '',
            linkEmbed: ep?.link_embed || '',
            serverName,
            sourceProvider: 'VSMov',
          };
        })
        .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));
      if (eps.length > 0) {
        allServers.push({ serverName, sourceProvider: 'VSMov', episodes: eps });
      }
    });
  }

  const m = kkData?.movie || opData?.movie || ncData?.movie || xkData?.movie || vsData?.movie;
  if (!m) return null;

  // HiPhim Automatic Stream Rescue: if no server has a direct .m3u8 stream (e.g. NguonC slug differed),
  // automatically search KKPhim by movie title / origin_name and inject direct .m3u8 streams!
  const hasDirectM3u8 = allServers.some((s) =>
    s.episodes.some((ep) => Boolean(ep.linkM3u8 && ep.linkM3u8.trim()))
  );
  if (!hasDirectM3u8) {
    const searchKeywords = [
      m.name,
      m.origin_name || m.original_name,
      cleanSlug.replace(/-/g, ' '),
    ].filter((k, idx, arr) => Boolean(k && String(k).trim()) && arr.indexOf(k) === idx);

    const normText = (str?: string) =>
      String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const targetNormName = normText(m.name);
    const targetNormOrigin = normText(m.origin_name || m.original_name);

    for (const kw of searchKeywords) {
      try {
        const sRes = await fetch(
          `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(
            String(kw).trim()
          )}&limit=5`
        );
        if (!sRes.ok) continue;
        const sData = await sRes.json();
        const items = sData?.data?.items || sData?.items || [];
        if (!Array.isArray(items) || items.length === 0) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matched = items.find((it: any) => {
          const itN = normText(it?.name);
          const itO = normText(it?.origin_name);
          return (
            it?.slug === cleanSlug ||
            (targetNormName && (itN === targetNormName || itO === targetNormName)) ||
            (targetNormOrigin && (itO === targetNormOrigin || itN === targetNormOrigin))
          );
        }) || items[0];

        if (matched?.slug) {
          const rescueRes = await fetch(
            `https://phimapi.com/phim/${encodeURIComponent(matched.slug)}`
          );
          if (rescueRes.ok) {
            const rescueData = await rescueRes.json();
            const rescueEps = Array.isArray(rescueData?.episodes) ? rescueData.episodes : [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rescueEps.forEach((srv: any, sIdx: number) => {
              const rawSrvName = srv?.server_name || `VIP #${sIdx + 1}`;
              const serverName = `⚡ [Tự Động HLS] ${rawSrvName}`;
              const serverData = Array.isArray(srv?.server_data) ? srv.server_data : [];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const eps: DirectEpisodeItem[] = serverData
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((ep: any, idx: number) => {
                  const epNumMatch = String(ep?.name || ep?.slug || '').match(/\d+/);
                  const epNum = epNumMatch ? parseInt(epNumMatch[0], 10) : idx + 1;
                  return {
                    id: `phim_${matched.slug}:${epNum}`,
                    name: ep?.name || `Tập ${idx + 1}`,
                    slug: ep?.slug || `${idx + 1}`,
                    episodeNumber: epNum,
                    linkM3u8: ep?.link_m3u8 || '',
                    linkEmbed: ep?.link_embed || '',
                    serverName,
                    sourceProvider: 'KKPhim',
                  };
                })
                .filter((e: DirectEpisodeItem) => Boolean(e.linkM3u8 || e.linkEmbed));

              if (eps.length > 0) {
                allServers.unshift({ serverName, sourceProvider: 'KKPhim', episodes: eps });
              }
            });
            if (
              allServers.some((s) =>
                s.episodes.some((ep) => Boolean(ep.linkM3u8 && ep.linkM3u8.trim()))
              )
            ) {
              break;
            }
          }
        }
      } catch {
        // continue
      }
    }
  }

  // Inject donor .m3u8 links into any server episodes that only have linkEmbed
  const donorServer = allServers.find((s) =>
    s.episodes.some((ep) => Boolean(ep.linkM3u8 && ep.linkM3u8.trim()))
  );
  if (donorServer) {
    allServers.forEach((srv) => {
      srv.episodes.forEach((ep, idx) => {
        if (!ep.linkM3u8) {
          const donorEp =
            donorServer.episodes.find((d) => d.episodeNumber === ep.episodeNumber) ||
            donorServer.episodes[idx];
          if (donorEp?.linkM3u8) {
            ep.linkM3u8 = donorEp.linkM3u8;
          }
        }
      });
    });
  }

  // Sort servers so servers with direct .m3u8 streams always come first
  allServers.sort((a, b) => {
    const aHasM3u8 = a.episodes.some((e) => Boolean(e.linkM3u8)) ? 1 : 0;
    const bHasM3u8 = b.episodes.some((e) => Boolean(e.linkM3u8)) ? 1 : 0;
    return bHasM3u8 - aHasM3u8;
  });

  const isKkOrOp = Boolean(kkData?.movie || opData?.movie);
  const cdn = kkData?.movie ? 'https://phimimg.com' : 'https://img.ophim.live/uploads/movies';
  const poster = isKkOrOp
    ? normalizeKkphimPoster(m.poster_url || m.thumb_url, cdn)
    : m.thumb_url || m.poster_url || '';
  const background = isKkOrOp
    ? normalizeKkphimPoster(m.thumb_url || m.poster_url, cdn)
    : m.poster_url || m.thumb_url || '';

  const totalEps = allServers.reduce((acc, s) => Math.max(acc, s.episodes.length), 0);
  const countriesList = Array.isArray(m.country)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.country.map((c: any) => c?.name).filter(Boolean)
    : [];
  const directorsList = Array.isArray(m.director)
    ? m.director.filter(Boolean)
    : m.director
    ? [String(m.director)]
    : [];
  const rawVote = m?.tmdb?.vote_average || m?.imdb?.vote_average;
  const tmdbVote = rawVote && Number(rawVote) > 0 ? Number(rawVote).toFixed(1) : '8.6';

  const detail: DirectMovieDetail = {
    id: `phim_${cleanSlug}`,
    slug: cleanSlug,
    name: m.name || m.origin_name || m.original_name || cleanSlug,
    originName: m.origin_name || m.original_name || '',
    poster,
    background,
    year: m.year ? String(m.year) : '2026',
    quality: m.quality || 'FHD',
    lang: m.lang || m.language || 'Vietsub',
    episodeCurrent: m.episode_current || m.current_episode || 'Full',
    time: m.time || '',
    duration: m.time || '',
    tmdbVote,
    description: stripHtmlTags(m.content || m.description || ''),
    country: countriesList.join(', '),
    countries: countriesList,
    genres: Array.isArray(m.category)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.category.map((c: any) => c?.name).filter(Boolean)
      : [],
    director: directorsList.join(', '),
    directors: directorsList,
    actors: Array.isArray(m.actor)
      ? m.actor.filter(Boolean)
      : typeof m.casts === 'string'
      ? m.casts.split(',').map((s: string) => s.trim())
      : [],
    type: m.type === 'series' || totalEps > 1 ? 'series' : 'movie',
    servers: allServers,
  };

  directDetailCache.set(cleanSlug, { ts: Date.now(), detail });
  return detail;
}

/**
 * Resolves playable streams for `/stream/:type/:id.json`
 */
export async function fetchDirectStreams(
  type: string,
  rawId: string
): Promise<StreamSourceItem[]> {
  // 1. Check Live TV channel
  if (type === 'tv' || rawId.startsWith('iptv_')) {
    const ch =
      DIRECT_LIVE_TV_CHANNELS.find((c) => c.id === rawId) ||
      DIRECT_LIVE_TV_CHANNELS.find((c) => rawId.includes(c.id.replace('iptv_', '')));
    if (ch) {
      const streams: StreamSourceItem[] = [];
      if (ch.isClearkey && ch.kidHex && ch.keyHex) {
        streams.push({
          name: `⚡ [Auraflix ClearKey DRM] ${ch.name}`,
          title: `📺 ${ch.name} • Luồng MPEG-DASH + ClearKey Giải Mã Trực Tiếp`,
          url: ch.streamUrl,
          isClearkeyFlag: true,
          kidHex: ch.kidHex,
          keyHex: ch.keyHex,
          qualityLabel: 'FHD',
          audioLabel: 'LIVE',
          behaviorHints: { isLive: true },
        });
      } else {
        streams.push({
          name: `⚡ [Luồng Chính FHD] ${ch.name}`,
          title: `📺 ${ch.name} • Luồng Trực Tiếp HLS Tốc Độ Cao`,
          url: ch.streamUrl,
          qualityLabel: 'FHD',
          audioLabel: 'LIVE',
          behaviorHints: { isLive: true },
        });
      }

      if (ch.fallbackUrl && ch.fallbackUrl !== ch.streamUrl) {
        streams.push({
          name: `🌐 [Luồng Dự Phòng #1] ${ch.name}`,
          title: `📺 ${ch.name} • Máy Chủ Dự Phòng #1`,
          url: ch.fallbackUrl,
          qualityLabel: 'HD',
          audioLabel: 'LIVE',
          behaviorHints: { isLive: true },
        });
      }
      if (Array.isArray(ch.backupUrls)) {
        ch.backupUrls.forEach((bUrl, idx) => {
          if (bUrl && bUrl !== ch.streamUrl && bUrl !== ch.fallbackUrl) {
            streams.push({
              name: `⚡ [Luồng Dự Phòng #${idx + 2}] ${ch.name}`,
              title: `📺 ${ch.name} • Máy Chủ Dự Phòng #${idx + 2}`,
              url: bUrl,
              qualityLabel: 'HD',
              audioLabel: 'LIVE',
              behaviorHints: { isLive: true },
            });
          }
        });
      }
      return streams;
    }
  }

  // 2. Parse movie/series slug and episode number (e.g., phim_dao-hai-tac:3)
  const parts = rawId.split(':');
  const baseId = parts[0];
  const targetEpNum = parts.length > 1 ? parseInt(parts[1], 10) || 1 : 1;

  const detail = await fetchDirectMovieDetail(baseId);
  if (!detail) return [];

  const streams: StreamSourceItem[] = [];
  for (const srv of detail.servers) {
    const ep =
      srv.episodes.find((e) => e.episodeNumber === targetEpNum) ||
      srv.episodes[targetEpNum - 1] ||
      srv.episodes[0];
    if (!ep) continue;

    const isThuyetMinh =
      srv.serverName.toLowerCase().includes('thuyết minh') ||
      srv.serverName.toLowerCase().includes('lồng tiếng');

    if (ep.linkM3u8) {
      streams.push({
        name: `${srv.serverName} (Direct HLS)`,
        title: `🎬 ${detail.name} • ${ep.name} • ${srv.serverName} [Direct .m3u8]`,
        url: ep.linkM3u8,
        fallbackEmbedUrl: ep.linkEmbed || undefined,
        priorityTier: isThuyetMinh ? 1 : 2,
        audioLabel: isThuyetMinh ? 'Thuyết Minh' : 'Vietsub',
        qualityLabel: detail.quality || 'FHD',
      });
    }
    if (ep.linkEmbed) {
      streams.push({
        name: `🌐 ${srv.serverName} (Web Embed)`,
        title: `🎬 ${detail.name} • ${ep.name} • Trình phát Web Embed (${srv.sourceProvider || 'Cloud'})`,
        embedUrl: ep.linkEmbed,
        externalUrl: ep.linkEmbed,
        priorityTier: 3,
        audioLabel: isThuyetMinh ? 'Thuyết Minh' : 'Vietsub',
        qualityLabel: 'HD',
      });
    }
  }

  // Attempt to fetch backend aggregated streams (VipTorrent, Asia CDN, etc.) if reachable
  try {
    const backendRes = await fetch(`/stream/${type}/${encodeURIComponent(rawId)}.json`, {
      headers: { Accept: 'application/json' },
    });
    if (backendRes.ok) {
      const bData = await backendRes.json();
      if (Array.isArray(bData?.streams) && bData.streams.length > 0) {
        const seenUrls = new Set(
          streams.map((s) => s.url || s.embedUrl || s.externalUrl).filter(Boolean)
        );
        for (const st of bData.streams) {
          const directUrl =
            st.url ||
            (st.infoHash
              ? `/api/stream-torrent?hash=${st.infoHash}&name=${encodeURIComponent(st.name || '')}&title=${encodeURIComponent(st.title || '')}`
              : '');
          const embedUrl = st.embedUrl || st.externalUrl || st.fallbackEmbedUrl || '';
          const targetKey = directUrl || embedUrl;
          if (targetKey && !seenUrls.has(targetKey)) {
            seenUrls.add(targetKey);
            const isTm =
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('thuyết minh') ||
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('lồng tiếng');
            const is4K =
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('4k') ||
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('2160p');
            const is1080 =
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('1080') ||
              (st.name + ' ' + (st.title || '')).toLowerCase().includes('fhd');
            streams.push({
              name: st.name || '⚡ Máy Chủ Dự Phòng',
              title: st.title || `🎬 Luồng phát ${st.name || ''}`,
              url: directUrl || undefined,
              embedUrl: embedUrl || undefined,
              externalUrl: embedUrl || undefined,
              priorityTier: isTm ? 1 : is4K ? 2 : directUrl ? 3 : 4,
              audioLabel: isTm ? 'Thuyết Minh' : 'Vietsub',
              qualityLabel: is4K ? '4K' : is1080 ? 'FHD' : 'HD',
              behaviorHints: st.behaviorHints,
            });
          }
        }
      }
    }
  } catch {
    // Continue with direct streams
  }

  // Sort Thuyết Minh & Direct HLS first
  streams.sort((a, b) => {
    const aDirect = Boolean(a.url);
    const bDirect = Boolean(b.url);
    if (aDirect !== bDirect) return aDirect ? -1 : 1;
    return (a.priorityTier || 2) - (b.priorityTier || 2);
  });

  return streams;
}

/**
 * Intercepts internal Stremio/Addon routes (`/catalog/...`, `/meta/...`, `/stream/...`, `/api/live-tv/...`)
 * and returns a standard JSON Response directly in the browser/WebView.
 */
export async function handleDirectClientRoute(urlStr: string): Promise<Response | null> {
  try {
    const parsedUrl = new URL(urlStr, 'https://localhost');
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // 1. /api/live-tv/channels
    if (pathname.startsWith('/api/live-tv/channels')) {
      return new Response(
        JSON.stringify({
          success: true,
          total: DIRECT_LIVE_TV_CHANNELS.length,
          channels: DIRECT_LIVE_TV_CHANNELS.map((c) => ({
            id: c.id,
            key: c.id.replace('iptv_', ''),
            name: c.name,
            poster: c.poster,
            genre: c.groupLabel,
            status: 'online',
            isClearkeyFlag: Boolean(c.isClearkey),
            kidHex: c.kidHex,
            keyHex: c.keyHex,
            streams: [
              {
                name: c.name,
                url: c.streamUrl,
                isClearkeyFlag: Boolean(c.isClearkey),
                kidHex: c.kidHex,
                keyHex: c.keyHex,
              },
            ],
          })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. /catalog/:type/:id(/extra).json
    const catalogMatch = pathname.match(/^\/catalog\/([^/]+)\/([^/]+)(?:\/([^/]+))?\.json$/i);
    if (catalogMatch) {
      const rawType = catalogMatch[1] as 'movie' | 'series' | 'tv';
      const rawCatId = catalogMatch[2].replace(/\.json$/i, '');
      const extraStr = catalogMatch[3] ? catalogMatch[3].replace(/\.json$/i, '') : '';

      let skip = 0;
      let search = parsedUrl.searchParams.get('search') || '';
      if (extraStr) {
        const skipMatch = extraStr.match(/skip=(\d+)/i);
        if (skipMatch) skip = parseInt(skipMatch[1], 10) || 0;
        const searchMatch = extraStr.match(/search=([^&/]+)/i);
        if (searchMatch) search = decodeURIComponent(searchMatch[1]);
      }

      const page = Math.floor(skip / 24) + 1;
      const result = await fetchDirectCatalog(rawType, rawCatId, { page, search });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. /meta/:type/:id.json
    const metaMatch = pathname.match(/^\/meta\/([^/]+)\/([^/]+)\.json$/i);
    if (metaMatch) {
      const rawType = metaMatch[1];
      const rawId = decodeURIComponent(metaMatch[2]);

      if (rawType === 'tv' || rawId.startsWith('iptv_')) {
        const ch =
          DIRECT_LIVE_TV_CHANNELS.find((c) => c.id === rawId) || DIRECT_LIVE_TV_CHANNELS[0];
        return new Response(
          JSON.stringify({
            meta: {
              id: ch.id,
              type: 'tv',
              name: ch.name,
              poster: ch.poster,
              background: ch.poster,
              description: ch.description,
              genres: [ch.groupLabel],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const detail = await fetchDirectMovieDetail(rawId);
      if (!detail) {
        return new Response(JSON.stringify({ meta: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const firstServer = detail.servers[0];
      const videos = (firstServer?.episodes || []).map((ep) => ({
        id: ep.id,
        title: ep.name,
        season: 1,
        episode: ep.episodeNumber,
      }));

      return new Response(
        JSON.stringify({
          meta: {
            id: detail.id,
            type: detail.type,
            name: detail.name,
            originName: detail.originName,
            poster: detail.poster,
            background: detail.background,
            year: detail.year,
            releaseInfo: detail.year,
            quality: detail.quality,
            lang: detail.lang,
            episodeCurrent: detail.episodeCurrent,
            description: detail.description,
            genres: detail.genres,
            director: detail.director,
            cast: detail.actors,
            videos,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. /stream/:type/:id.json
    const streamMatch = pathname.match(/^\/stream\/([^/]+)\/([^/]+)\.json$/i);
    if (streamMatch) {
      const rawType = streamMatch[1];
      const rawId = decodeURIComponent(streamMatch[2]);
      const streams = await fetchDirectStreams(rawType, rawId);
      return new Response(JSON.stringify({ streams }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return null;
  } catch {
    return null;
  }
}
