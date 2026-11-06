import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogMetaItem } from './PreviewWebApp';
import { PreviewTarget } from '../types';
import {
  DirectMovieDetail,
  fetchDirectCatalog,
  fetchDirectMovieDetail,
  getPreferredMovieSource,
  MovieSourceProvider,
  setPreferredMovieSource,
} from '../utils/directClientEngine';
import { CinemaHeroBackdrop } from './CinemaHeroBackdrop';
import { preloadSpotlightCarousel } from '../utils/tmdbImageResolver';
import {
  isAnimeMetaItem,
  filterNonAnime,
  curateSpotlightBlockbusters,
} from '../utils/animeFilter';

interface AndroidTvAppProps {
  onSwitchToWebMode: () => void;
  onOpenClassicAddon: () => void;
  onCheckUpdates: () => void;
  onSelectMedia: (item: CatalogMetaItem) => void;
  onPlayDirectStream?: (target: PreviewTarget) => void;
  onShowToast: (msg: string) => void;
}

type TvNavTab = 'search' | 'home' | 'movies' | 'explore' | 'mylist' | 'settings';

interface WatchProgressItem {
  id: string;
  type: 'movie' | 'series' | 'tv';
  name: string;
  poster?: string;
  background?: string;
  episodeNumber: number;
  episodeName: string;
  progressPercent: number;
  remainingMinutes: number;
  updatedAt: number;
}

const TV_WATCHLIST_KEY = 'phimtnui_tv_watchlist_v2';
const TV_HISTORY_KEY = 'phimtnui_tv_history_v2';

const TV_SOURCE_OPTIONS: Array<{ id: MovieSourceProvider; label: string }> = [
  { id: 'all', label: '🌐 Đa Nguồn (Gộp)' },
  { id: 'kkphim', label: '🇻🇳 KKPhim' },
  { id: 'ophim', label: '⚡ OPhim' },
  { id: 'nguonc', label: '🎬 NguonC' },
];

const GENRE_CHIPS = [
  { id: 'the_loai_co_trang', name: 'Cổ Trang' },
  { id: 'the_loai_hanh_dong', name: 'Hành Động' },
  { id: 'the_loai_tinh_cam', name: 'Tình Cảm' },
  { id: 'the_loai_tam_ly', name: 'Tâm Lý' },
  { id: 'the_loai_hinh_su', name: 'Hình Sự' },
  { id: 'the_loai_kinh_di', name: 'Kinh Dị' },
  { id: 'the_loai_vien_tuong', name: 'Viễn Tưởng' },
  { id: 'the_loai_vo_thuat', name: 'Võ Thuật' },
  { id: 'the_loai_hai_huoc', name: 'Hài Hước' },
  { id: 'the_loai_bi_an', name: 'Bí Ẩn' },
  { id: 'the_loai_gia_dinh', name: 'Gia Đình' },
  { id: 'the_loai_chien_tranh', name: 'Chiến Tranh' },
];

const COUNTRY_CHIPS = [
  { id: 'quoc_gia_trung_quoc', name: 'Trung Quốc' },
  { id: 'quoc_gia_han_quoc', name: 'Hàn Quốc' },
  { id: 'quoc_gia_au_my', name: 'Âu Mỹ' },
  { id: 'quoc_gia_viet_nam', name: 'Việt Nam' },
  { id: 'quoc_gia_nhat_ban', name: 'Nhật Bản' },
  { id: 'quoc_gia_thai_lan', name: 'Thái Lan' },
  { id: 'quoc_gia_hong_kong', name: 'Hồng Kông' },
  { id: 'quoc_gia_dai_loan', name: 'Đài Loan' },
];

const KEYBOARD_LETTERS = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z', '-', "'"],
];

const KEYBOARD_NUMBERS = [
  ['1', '2', '3', '4', '5', '6', '7'],
  ['8', '9', '0', 'đ', 'â', 'ê', 'ô'],
  ['ơ', 'ư', 'ă', 'á', 'à', 'ả', 'ạ'],
  ['é', 'è', 'ó', 'ò', 'ú', 'ù', 'ý'],
];

const VIETNAMESE_VARIANTS: Record<string, string[]> = {
  a: ['a', 'à', 'á', 'ả', 'ã', 'ạ', 'ă', 'ằ', 'ắ', 'ẳ', 'ẵ', 'ặ', 'â', 'ầ', 'ấ', 'ẩ', 'ẫ', 'ậ'],
  e: ['e', 'è', 'é', 'ẻ', 'ẽ', 'ẹ', 'ê', 'ề', 'ế', 'ể', 'ễ', 'ệ'],
  i: ['i', 'ì', 'í', 'ỉ', 'ĩ', 'ị'],
  o: ['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ồ', 'ố', 'ổ', 'ỗ', 'ộ', 'ơ', 'ờ', 'ớ', 'ở', 'ỡ', 'ợ'],
  u: ['u', 'ù', 'ú', 'ủ', 'ũ', 'ụ', 'ư', 'ừ', 'ứ', 'ử', 'ữ', 'ự'],
  y: ['y', 'ỳ', 'ý', 'ỷ', 'ỹ', 'ỵ'],
  d: ['d', 'đ'],
};

interface TvShelf {
  id: string;
  title: string;
  items: CatalogMetaItem[];
  isLoading: boolean;
  isTop10?: boolean;
}

export const AndroidTvApp: React.FC<AndroidTvAppProps> = ({
  onSwitchToWebMode,
  onOpenClassicAddon,
  onCheckUpdates,
  onSelectMedia,
  onPlayDirectStream,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<TvNavTab>('home');
  const isLockedTvApk =
    typeof window !== 'undefined' &&
    String((window as any).__PHIMTNUI_APP_FLAVOR__ || '').toLowerCase() === 'androidtv';

  const [movieSource, setMovieSourceState] = useState<MovieSourceProvider>(() =>
    getPreferredMovieSource()
  );
  const [preferredLinkMode, setPreferredLinkMode] = useState<'hls' | 'embed'>('hls');

  const handleSelectMovieSource = useCallback(
    (src: MovieSourceProvider) => {
      setPreferredMovieSource(src);
      setMovieSourceState(src);
      const found = TV_SOURCE_OPTIONS.find((s) => s.id === src);
      onShowToast(`🖧 Đã chuyển nguồn phim TV: ${found?.label || src}`);
    },
    [onShowToast]
  );

  // Home shelves
  const [shelves, setShelves] = useState<TvShelf[]>([
    {
      id: 'shelf_top10',
      title: 'Top 10 phim mới cập nhật hôm nay',
      items: [],
      isLoading: true,
      isTop10: true,
    },
    { id: 'shelf_bo', title: 'Phim bộ đang phát sóng hot nhất', items: [], isLoading: true },
    { id: 'shelf_tm', title: 'Phim thuyết minh & lồng tiếng', items: [], isLoading: true },
    { id: 'shelf_le', title: 'Phim lẻ điện ảnh đặc sắc', items: [], isLoading: true },
    { id: 'shelf_hh', title: 'Hoạt hình & Anime chọn lọc', items: [], isLoading: true },
  ]);

  const [featuredItems, setFeaturedItems] = useState<CatalogMetaItem[]>([]);
  const [featuredIdx, setFeaturedIdx] = useState<number>(0);

  // Watchlist & Continue Watching
  const [watchlist, setWatchlist] = useState<CatalogMetaItem[]>(() => {
    try {
      const raw = localStorage.getItem(TV_WATCHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [watchHistory, setWatchHistory] = useState<WatchProgressItem[]>(() => {
    try {
      const raw = localStorage.getItem(TV_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Detail modal state (Rap Nha tv-04-chi-tiet-phim.jpg style)
  const [selectedDetailItem, setSelectedDetailItem] = useState<CatalogMetaItem | null>(null);
  const [movieDetail, setMovieDetail] = useState<DirectMovieDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [selectedServerIdx, setSelectedServerIdx] = useState<number>(0);
  const [showEpisodeSheet, setShowEpisodeSheet] = useState<boolean>(false);

  // Search state (Rap Nha tv-08-tim-kiem.jpg split-screen style)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CatalogMetaItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isNumKeyboard, setIsNumKeyboard] = useState<boolean>(false);
  const [variantPopupKey, setVariantPopupKey] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Movies & Explore tab state
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('cat_moi_cap_nhat');
  const [categoryItems, setCategoryItems] = useState<CatalogMetaItem[]>([]);
  const [isLoadingCategory, setIsLoadingCategory] = useState<boolean>(false);
  const [categoryPage, setCategoryPage] = useState<number>(1);

  // Load initial shelves using Direct Client Engine
  useEffect(() => {
    let mounted = true;

    const loadAllShelves = async () => {
      const configs: Array<{
        type: 'movie' | 'series' | 'tv';
        cat: string;
        shelfId: string;
      }> = [
        { type: 'movie', cat: 'cat_moi_cap_nhat', shelfId: 'shelf_top10' },
        { type: 'series', cat: 'cat_phim_bo', shelfId: 'shelf_bo' },
        { type: 'movie', cat: 'cat_phim_le_thuyet_minh', shelfId: 'shelf_tm' },
        { type: 'movie', cat: 'cat_phim_le', shelfId: 'shelf_le' },
        { type: 'movie', cat: 'cat_hoat_hinh', shelfId: 'shelf_hh' },
      ];

      let chieuRapMetas: CatalogMetaItem[] = [];
      try {
        const rapRes = await fetchDirectCatalog('movie', 'cat_phim_chieu_rap', {
          page: 1,
          source: movieSource,
        });
        if (rapRes?.metas) {
          chieuRapMetas = filterNonAnime(rapRes.metas);
        }
      } catch {
        // ignore
      }

      await Promise.all(
        configs.map(async (cfg) => {
          try {
            const res = await fetchDirectCatalog(cfg.type, cfg.cat, {
              page: 1,
              source: movieSource,
            });
            if (!mounted) return;
            const rawMetas: CatalogMetaItem[] = res.metas || [];
            const cleanMetas = cfg.shelfId === 'shelf_hh' ? rawMetas : filterNonAnime(rawMetas);
            setShelves((prev) =>
              prev.map((s) =>
                s.id === cfg.shelfId ? { ...s, items: cleanMetas, isLoading: false } : s
              )
            );
            if (cfg.shelfId === 'shelf_top10') {
              const curated = curateSpotlightBlockbusters(chieuRapMetas, cleanMetas, [], 6);
              if (curated.length > 0) {
                setFeaturedItems(curated);
              }
            }
          } catch {
            if (!mounted) return;
            setShelves((prev) =>
              prev.map((s) => (s.id === cfg.shelfId ? { ...s, isLoading: false } : s))
            );
          }
        })
      );
    };

    loadAllShelves();
    return () => {
      mounted = false;
    };
  }, [movieSource]);

  // Auto-rotate hero showcase on Home if user hasn't opened detail
  useEffect(() => {
    if (activeTab !== 'home' || selectedDetailItem || featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      setFeaturedIdx((prev) => (prev + 1) % featuredItems.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [activeTab, selectedDetailItem, featuredItems.length]);

  const currentHero = useMemo(() => {
    return featuredItems[featuredIdx] || shelves[0]?.items[0] || null;
  }, [featuredItems, featuredIdx, shelves]);

  // Load category items when in 'movies' or 'explore' tab
  useEffect(() => {
    if (activeTab !== 'movies' && activeTab !== 'explore') return;
    let mounted = true;
    setIsLoadingCategory(true);
    fetchDirectCatalog('movie', activeCategoryFilter, {
      page: categoryPage,
      source: movieSource,
    })
      .then((res) => {
        if (!mounted) return;
        const raw = res.metas || [];
        const clean = activeCategoryFilter === 'cat_hoat_hinh' ? raw : filterNonAnime(raw);
        setCategoryItems((prev) =>
          categoryPage === 1 ? clean : [...prev, ...clean]
        );
      })
      .finally(() => {
        if (mounted) setIsLoadingCategory(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, activeCategoryFilter, categoryPage, movieSource]);

  // Instant search effect
  useEffect(() => {
    if (activeTab !== 'search') return;
    let mounted = true;
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (!q) {
          const defaultRes = await fetchDirectCatalog('movie', 'cat_moi_cap_nhat', {
            page: 1,
            source: movieSource,
          });
          if (mounted) setSearchResults(defaultRes.metas || []);
        } else {
          const res = await fetchDirectCatalog('movie', 'cat_moi_cap_nhat', {
            page: 1,
            search: q,
            source: movieSource,
          });
          if (mounted) setSearchResults(res.metas || []);
        }
      } finally {
        if (mounted) setIsSearching(false);
      }
    }, 240);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, searchQuery, movieSource]);

  // Open Movie Detail view
  const handleOpenMovieDetail = useCallback(async (item: CatalogMetaItem) => {
    setSelectedDetailItem(item);
    setMovieDetail(null);
    setSelectedServerIdx(0);
    setShowEpisodeSheet(false);
    setIsLoadingDetail(true);

    try {
      const detail = await fetchDirectMovieDetail(item.id);
      setMovieDetail(detail);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Save watch history helper
  const recordWatchHistory = useCallback(
    (item: CatalogMetaItem | DirectMovieDetail, epNum = 1, epName = 'Tập 1') => {
      const entry: WatchProgressItem = {
        id: item.id,
        type: item.type,
        name: item.name,
        poster: item.poster,
        background: item.background || item.poster,
        episodeNumber: epNum,
        episodeName: epName,
        progressPercent: Math.min(85, Math.max(18, ((epNum * 17) % 70) + 15)),
        remainingMinutes: Math.max(12, 48 - ((epNum * 7) % 30)),
        updatedAt: Date.now(),
      };
      setWatchHistory((prev) => {
        const next = [entry, ...prev.filter((x) => x.id !== entry.id)].slice(0, 20);
        try {
          localStorage.setItem(TV_HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  // Play episode or movie immediately
  const handlePlayEpisode = useCallback(
    (
      detailOrItem: DirectMovieDetail | CatalogMetaItem,
      serverIdx = 0,
      episodeNumber = 1,
      linkModeOverride?: 'hls' | 'embed'
    ) => {
      const mode = linkModeOverride || preferredLinkMode;
      if ('servers' in detailOrItem && detailOrItem.servers.length > 0) {
        const srv = detailOrItem.servers[serverIdx] || detailOrItem.servers[0];
        const ep =
          srv.episodes.find((e) => e.episodeNumber === episodeNumber) ||
          srv.episodes[episodeNumber - 1] ||
          srv.episodes[0];

        if (ep) {
          recordWatchHistory(detailOrItem, ep.episodeNumber, ep.name);
          if (onPlayDirectStream) {
            const chosenDirect =
              mode === 'embed'
                ? ep.linkEmbed || ep.linkM3u8
                : ep.linkM3u8 || ep.linkEmbed;
            const chosenFallback =
              mode === 'embed'
                ? ep.linkM3u8 || undefined
                : ep.linkEmbed || undefined;

            onPlayDirectStream({
              streamUrl: `/stream/${detailOrItem.type}/${detailOrItem.id}:1:${ep.episodeNumber}.json`,
              streamName: `${detailOrItem.name} — ${ep.name} (${srv.serverName})`,
              streamType: 'vod',
              directPlayUrl: chosenDirect,
              fallbackEmbedUrl: chosenFallback,
            });
            return;
          }
        }
      }

      recordWatchHistory(detailOrItem, episodeNumber, `Tập ${episodeNumber}`);
      onSelectMedia({
        id: `${detailOrItem.id}:1:${episodeNumber}`,
        type: detailOrItem.type,
        name: detailOrItem.name,
        poster: detailOrItem.poster,
        background: detailOrItem.background,
      });
    },
    [onPlayDirectStream, onSelectMedia, preferredLinkMode, recordWatchHistory]
  );

  const toggleWatchlist = useCallback(
    (item: CatalogMetaItem) => {
      setWatchlist((prev) => {
        const exists = prev.some((x) => x.id === item.id);
        const next = exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
        try {
          localStorage.setItem(TV_WATCHLIST_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        onShowToast(
          exists
            ? `🗑️ Đã xóa "${item.name}" khỏi Danh sách của tôi`
            : `✓ Đã thêm "${item.name}" vào Danh sách của tôi`
        );
        return next;
      });
    },
    [onShowToast]
  );

  const isSavedInWatchlist = useCallback(
    (id?: string) => Boolean(id && watchlist.some((x) => x.id === id)),
    [watchlist]
  );

  // Back/Escape handler for Detail Modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never block typing when an input/textarea is focused
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (variantPopupKey) {
          e.preventDefault();
          setVariantPopupKey(null);
          return;
        }
        if (showEpisodeSheet) {
          e.preventDefault();
          setShowEpisodeSheet(false);
          return;
        }
        if (selectedDetailItem) {
          e.preventDefault();
          setSelectedDetailItem(null);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDetailItem, showEpisodeSheet, variantPopupKey]);

  const appendCharToSearch = (char: string) => {
    setSearchQuery((prev) => prev + char);
    setVariantPopupKey(null);
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0E0E10] text-[#F4F1EA] font-sans overflow-hidden flex select-none">
      {/* =====================================================================
          LEFT SLIM NAVIGATION SIDEBAR (RAP NHA tv-02-trang-chu.jpg STYLE)
         ===================================================================== */}
      <aside className="w-16 sm:w-20 h-full bg-[#0E0E10]/95 border-r border-white/[0.06] flex flex-col items-center justify-between py-4 sm:py-6 z-40 shrink-0">
        {/* Top Brand Icon (Luxury Phimtnui Play-P Emblem) */}
        <button
          type="button"
          onClick={() => {
            setSelectedDetailItem(null);
            setActiveTab('home');
          }}
          className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FDE68A]/60 via-[#84F828]/35 to-[#F59E0B]/60 p-[1.5px] shadow-lg shadow-[#F2B544]/25 hover:scale-105 focus:ring-2 focus:ring-white transition-transform cursor-pointer"
          title="Phimtnui Trang chủ"
        >
          <div className="w-full h-full rounded-[14px] bg-[#0B1020] flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 108 108" fill="none">
              <rect x="31" y="26" width="10" height="56" rx="5" fill="#F7B928" />
              <path
                d="M45 27 L76 44 C80 46 80 51 76 53 L45 70 C41 72 38 69 38 65 L38 57 L60 48.5 L38 40 L38 32 C38 28 41 25 45 27 Z"
                fill="#F5A623"
              />
              <path d="M45 41.5 L59 48.5 L45 55.5 Z" fill="#84F828" />
              <circle cx="50" cy="77" r="5" fill="#84F828" />
            </svg>
          </div>
        </button>

        {/* Center Navigation Icons */}
        <nav className="flex flex-col items-center gap-2 sm:gap-3">
          {[
            {
              id: 'search' as TvNavTab,
              label: 'Tìm kiếm',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-4.2-4.2" />
                </svg>
              ),
            },
            {
              id: 'home' as TvNavTab,
              label: 'Trang chủ',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z" />
                </svg>
              ),
            },
            {
              id: 'movies' as TvNavTab,
              label: 'Phim Điện Ảnh & Phim Bộ',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 4v16M17 4v16M3 8h4M17 8h4M3 12h18M3 16h4M17 16h4" />
                </svg>
              ),
            },
            {
              id: 'explore' as TvNavTab,
              label: 'Khám Phá Thể Loại & Quốc Gia',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              ),
            },
            {
              id: 'mylist' as TvNavTab,
              label: 'Danh sách của tôi',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a1 1 0 0 1 1 1v15l-8-4-8 4V5a1 1 0 0 1 1-1Z" />
                </svg>
              ),
            },
            {
              id: 'settings' as TvNavTab,
              label: 'Cài đặt & Đổi giao diện',
              svg: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                  <circle cx="8" cy="6" r="2" fill="#0E0E10" />
                  <circle cx="16" cy="12" r="2" fill="#0E0E10" />
                  <circle cx="10" cy="18" r="2" fill="#0E0E10" />
                </svg>
              ),
            },
          ].map((nav) => {
            const isActive = activeTab === nav.id && !selectedDetailItem;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setSelectedDetailItem(null);
                  setActiveTab(nav.id);
                }}
                title={nav.label}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F2B544] ${
                  isActive
                    ? 'bg-[#25252D] text-[#F4F1EA] shadow-md ring-1 ring-white/15'
                    : 'text-[#A9A6A0] hover:text-[#F4F1EA] hover:bg-white/5'
                }`}
              >
                {nav.svg}
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile & Quick Web Switch (only when not locked in TV APK) */}
        <div className="flex flex-col items-center gap-2.5">
          {!isLockedTvApk && (
            <button
              type="button"
              onClick={onSwitchToWebMode}
              title="Về Giao diện Web"
              className="w-10 h-10 rounded-full bg-[#1E1E24] hover:bg-[#F2B544] text-[#C9C5BD] hover:text-[#0E0E10] border border-white/10 flex items-center justify-center text-xs font-bold transition-all cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
            >
              🌐
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedDetailItem(null);
              setActiveTab('mylist');
            }}
            title="Hồ sơ của tôi"
            className="w-9 h-9 rounded-full bg-[#3A6073] text-white font-bold text-sm flex items-center justify-center border border-white/20 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
          >
            T
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN VIEWPORT AREA (EDGE-TO-EDGE FULLSCREEN)
         ===================================================================== */}
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth">
        {/* ===================================================================
            MOVIE DETAIL OVERLAY (RAP NHA tv-04-chi-tiet-phim.jpg STYLE)
           =================================================================== */}
        {selectedDetailItem ? (
          <div className="relative min-h-full w-full bg-[#0E0E10] flex flex-col justify-between">
            {/* Full-bleed Right-side Backdrop with Obsidian Left/Bottom Gradient */}
            <div className="fixed inset-0 left-16 sm:left-20 pointer-events-none z-0">
              <img
                src={
                  movieDetail?.background ||
                  selectedDetailItem.background ||
                  selectedDetailItem.poster
                }
                alt={selectedDetailItem.name}
                className="w-full h-full object-cover object-center opacity-55"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, #0E0E10 0%, rgba(14,14,16,0.94) 38%, rgba(14,14,16,0.45) 72%, rgba(14,14,16,0.2) 100%), linear-gradient(180deg, rgba(14,14,16,0.3) 0%, rgba(14,14,16,0.6) 65%, #0E0E10 100%)',
                }}
              />
            </div>

            <div className="relative z-10 px-6 sm:px-12 py-6 sm:py-9 space-y-6">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#C9C5BD] hover:text-white text-sm font-medium transition-colors cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
              >
                <span>‹</span>
                <span>Quay lại</span>
              </button>

              {/* Title & Metadata */}
              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl sm:text-5xl font-extrabold text-[#F4F1EA] tracking-tight leading-tight">
                  {movieDetail?.name || selectedDetailItem.name}
                </h1>
                {(movieDetail?.originName || selectedDetailItem.originName) && (
                  <p className="text-base sm:text-lg text-[#A9A6A0] font-medium">
                    {movieDetail?.originName || selectedDetailItem.originName}
                  </p>
                )}

                {/* Meta Row (Gold Episode + Year + Duration + Badges) */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[#C9C5BD] pt-1">
                  <span className="font-bold text-[#F2B544]">
                    {movieDetail?.episodeCurrent ||
                      selectedDetailItem.episodeCurrent ||
                      'Tập Mới'}
                  </span>
                  <span>•</span>
                  <span>{movieDetail?.year || selectedDetailItem.year || '2026'}</span>
                  <span>•</span>
                  <span>{movieDetail?.duration || '45 phút/tập'}</span>
                  <span className="px-2 py-0.5 rounded border border-white/25 text-xs font-bold text-[#F4F1EA]">
                    {movieDetail?.quality || selectedDetailItem.quality || 'HD'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded border border-white/25 text-xs font-medium text-[#F4F1EA]">
                    Vietsub
                  </span>
                  <span className="px-2.5 py-0.5 rounded border border-[#F2B544]/50 text-xs font-semibold text-[#F2B544]">
                    Thuyết Minh
                  </span>
                </div>

                {/* Synopsis */}
                <p className="text-sm sm:text-base text-[#C9C5BD] leading-relaxed line-clamp-3 pt-1">
                  {isLoadingDetail
                    ? 'Đang tải thông tin chi tiết phim và danh sách tập...'
                    : movieDetail?.description ||
                      selectedDetailItem.description ||
                      'Bộ phim hấp dẫn với hình ảnh sắc nét Full HD, hỗ trợ đầy đủ luồng phát Vietsub và Thuyết Minh.'}
                </p>

                {/* Director / Cast / Genre (Rap Nha tv-04 style) */}
                {movieDetail && (
                  <div className="space-y-1 text-xs sm:text-sm text-[#A9A6A0] pt-1">
                    <div>
                      <span className="text-[#C9C5BD] font-semibold">Đạo diễn: </span>
                      <span>{movieDetail.directors.slice(0, 3).join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[#C9C5BD] font-semibold">Diễn viên: </span>
                      <span>{movieDetail.actors.slice(0, 6).join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[#C9C5BD] font-semibold">Thể loại: </span>
                      <span>
                        {[...movieDetail.genres, ...movieDetail.countries]
                          .slice(0, 5)
                          .join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons with Gold Ring on Primary CTA */}
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      handlePlayEpisode(
                        movieDetail || selectedDetailItem,
                        selectedServerIdx,
                        1
                      )
                    }
                    className="px-6 py-3.5 rounded-2xl bg-[#F4F1EA] hover:bg-white text-[#0E0E10] font-extrabold text-sm sm:text-base ring-2 ring-[#F2B544] ring-offset-2 ring-offset-[#0E0E10] shadow-xl flex items-center gap-2.5 cursor-pointer transition-transform active:scale-95"
                  >
                    <span>▶</span>
                    <span>Xem ngay Tập 1</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handlePlayEpisode(
                        movieDetail || selectedDetailItem,
                        selectedServerIdx,
                        1
                      )
                    }
                    className="px-5 py-3.5 rounded-2xl bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-sm sm:text-base border border-white/10 flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                  >
                    <span>↺</span>
                    <span>Xem từ đầu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEpisodeSheet((prev) => !prev)}
                    className={`px-5 py-3.5 rounded-2xl font-semibold text-sm sm:text-base border flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                      showEpisodeSheet
                        ? 'bg-[#F2B544] text-[#0E0E10] border-[#F2B544]'
                        : 'bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] border-white/10'
                    }`}
                  >
                    <span>☰</span>
                    <span>
                      Tập phim ({movieDetail?.servers[selectedServerIdx]?.episodes.length || 1})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleWatchlist(selectedDetailItem)}
                    className="w-12 h-12 rounded-full bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] border border-white/10 flex items-center justify-center text-lg font-bold cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                    title="Thêm vào Danh sách của tôi"
                  >
                    {isSavedInWatchlist(selectedDetailItem.id) ? '✓' : '+'}
                  </button>
                </div>
              </div>

              {/* SERVER, LINK MODE & EPISODE SELECTOR PANEL */}
              {movieDetail && movieDetail.servers.length > 0 && (
                <div className="bg-[#16161B]/95 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 max-w-5xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm sm:text-base font-bold text-[#F4F1EA] flex items-center gap-2">
                      <span>🖧 Chọn Nguồn & Server ({movieDetail.servers.length} nguồn):</span>
                    </div>

                    {/* Server Tabs (KKPhim / OPhim / NguonC) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {movieDetail.servers.map((srv, idx) => (
                        <button
                          key={srv.serverName + idx}
                          type="button"
                          onClick={() => setSelectedServerIdx(idx)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                            selectedServerIdx === idx
                              ? 'bg-[#F2B544] text-[#0E0E10] shadow-md'
                              : 'bg-[#25252D] text-[#C9C5BD] hover:text-white border border-white/10'
                          }`}
                        >
                          {srv.serverName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stream Link Type Selector (Direct HLS .m3u8 vs Web Embed + Copy Link) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/35 border border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-[#F2B544]">
                        🔗 Chọn Loại Link Phát:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreferredLinkMode('hls')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                          preferredLinkMode === 'hls'
                            ? 'bg-[#F2B544] text-[#0E0E10]'
                            : 'bg-[#25252E] text-[#C9C5BD]'
                        }`}
                      >
                        ⚡ Luồng Direct HLS (.m3u8)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreferredLinkMode('embed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                          preferredLinkMode === 'embed'
                            ? 'bg-[#F2B544] text-[#0E0E10]'
                            : 'bg-[#25252E] text-[#C9C5BD]'
                        }`}
                      >
                        🌐 Luồng Web Embed
                      </button>
                    </div>

                    {(() => {
                      const ep0 = movieDetail.servers[selectedServerIdx]?.episodes[0];
                      const activeLink =
                        preferredLinkMode === 'embed'
                          ? ep0?.linkEmbed || ep0?.linkM3u8
                          : ep0?.linkM3u8 || ep0?.linkEmbed;
                      if (!activeLink) return null;
                      return (
                        <div className="flex items-center gap-2 min-w-0 max-w-md">
                          <span className="text-[11px] font-mono text-[#A9A6A0] truncate">
                            {activeLink}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard?.writeText) {
                                navigator.clipboard.writeText(activeLink);
                              }
                              onShowToast('📋 Đã sao chép link phát trực tiếp!');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#F2B544]/20 border border-[#F2B544]/40 text-[#F2B544] text-xs font-bold shrink-0 cursor-pointer"
                          >
                            📋 Chép Link
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Episodes Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-52 overflow-y-auto pr-1">
                    {(movieDetail.servers[selectedServerIdx]?.episodes || []).map((ep) => (
                      <button
                        key={ep.id + ep.slug}
                        type="button"
                        onClick={() =>
                          handlePlayEpisode(
                            movieDetail,
                            selectedServerIdx,
                            ep.episodeNumber
                          )
                        }
                        className="px-3 py-2.5 rounded-xl bg-[#22222A] hover:bg-[#F2B544] text-[#F4F1EA] hover:text-[#0E0E10] font-bold text-xs sm:text-sm border border-white/10 hover:border-[#F2B544] transition-all truncate cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                      >
                        {ep.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* RELATED MOVIES ("Có thể bạn cũng thích" — Rap Nha tv-04) */}
              <div className="space-y-3 pt-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#F4F1EA]">
                  Có thể bạn cũng thích
                </h2>
                <div className="flex items-center gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {(shelves[0]?.items || []).slice(0, 10).map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => handleOpenMovieDetail(rel)}
                      className="group relative w-48 sm:w-56 shrink-0 text-left rounded-xl overflow-hidden bg-[#1E1E24] border-2 border-transparent hover:border-[#F2B544] focus:border-[#F2B544] transition-all cursor-pointer"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-[#141418]">
                        <img
                          src={rel.background || rel.poster}
                          alt={rel.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2.5">
                        <div className="font-bold text-xs sm:text-sm text-[#F4F1EA] truncate">
                          {rel.name}
                        </div>
                        <div className="text-[11px] text-[#A9A6A0] truncate">
                          {rel.year || '2026'} • {rel.episodeCurrent || 'HD'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ===================================================================
            TAB 1: SEARCH SCREEN (RAP NHA tv-08-tim-kiem.jpg SPLIT SCREEN)
            Works with BOTH Native Phone/TV Keyboard AND On-Screen Virtual Keyboard!
           =================================================================== */}
        {!selectedDetailItem && activeTab === 'search' && (
          <div className="min-h-full w-full px-5 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            {/* LEFT COLUMN: NATIVE SEARCH INPUT + VIRTUAL KEYBOARD */}
            <div className="lg:col-span-5 space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[#A9A6A0]">
                TÌM PHIM, DIỄN VIÊN, THỂ LOẠI
              </div>

              {/* Native Input Box (Tapping opens phone keyboard, or use virtual keys below) */}
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#A9A6A0] text-lg pointer-events-none">
                  🔍
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập tên phim (có dấu hoặc không dấu)..."
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full pl-11 pr-20 py-3.5 rounded-2xl bg-[#1A1A1F] border-2 border-[#2A2A31] focus:border-[#F2B544] text-[#F4F1EA] placeholder-[#A9A6A0] text-base font-semibold focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-[#F4F1EA] cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>

              {/* Vietnamese Accent Variant Bar when a vowel/d is selected */}
              {variantPopupKey && VIETNAMESE_VARIANTS[variantPopupKey] && (
                <div className="p-2.5 rounded-2xl bg-[#25252E] border border-[#F2B544] flex flex-wrap items-center gap-1.5 shadow-xl">
                  <span className="text-xs text-[#F2B544] font-bold px-2">Chọn dấu:</span>
                  {VIETNAMESE_VARIANTS[variantPopupKey].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => appendCharToSearch(v)}
                      className="w-9 h-9 rounded-xl bg-[#1A1A1F] hover:bg-[#F2B544] text-[#F4F1EA] hover:text-[#0E0E10] font-bold text-sm flex items-center justify-center cursor-pointer"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setVariantPopupKey(null)}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-white/10 text-xs text-[#C9C5BD]"
                  >
                    Đóng
                  </button>
                </div>
              )}

              {/* On-Screen 7-Column Virtual Keyboard (Rap Nha tv-08-tim-kiem.jpg) */}
              <div className="space-y-2 select-none">
                {(isNumKeyboard ? KEYBOARD_NUMBERS : KEYBOARD_LETTERS).map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {row.map((keyChar) => {
                      const hasVariants = Boolean(VIETNAMESE_VARIANTS[keyChar]);
                      return (
                        <button
                          key={keyChar}
                          type="button"
                          onClick={() => appendCharToSearch(keyChar)}
                          onContextMenu={(e) => {
                            if (hasVariants) {
                              e.preventDefault();
                              setVariantPopupKey(keyChar);
                            }
                          }}
                          className="h-10 sm:h-11 rounded-xl bg-[#1A1A1F] hover:bg-[#2A2A32] active:bg-[#F2B544] active:text-[#0E0E10] border border-white/5 hover:border-[#F2B544] text-[#F4F1EA] font-semibold text-sm sm:text-base flex items-center justify-center transition-all cursor-pointer focus:ring-2 focus:ring-[#F2B544] relative"
                        >
                          <span>{keyChar}</span>
                          {hasVariants && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setVariantPopupKey(
                                  variantPopupKey === keyChar ? null : keyChar
                                );
                              }}
                              title="Chọn dấu tiếng Việt"
                              className="absolute top-0.5 right-1 text-[9px] text-[#F2B544] opacity-80 hover:opacity-100"
                            >
                              •
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Bottom Action Row: &123 | Dấu cách | Xóa | Xóa hết */}
                <div className="grid grid-cols-12 gap-1.5 sm:gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsNumKeyboard((prev) => !prev)}
                    className="col-span-3 h-11 rounded-xl bg-[#1A1A1F] hover:bg-[#2A2A32] text-[#F2B544] font-bold text-xs sm:text-sm border border-white/10 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                  >
                    {isNumKeyboard ? 'ABC' : '&123 / Dấu'}
                  </button>
                  <button
                    type="button"
                    onClick={() => appendCharToSearch(' ')}
                    className="col-span-4 h-11 rounded-xl bg-[#1A1A1F] hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-xs sm:text-sm border border-white/10 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                  >
                    Dấu cách
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((prev) => prev.slice(0, -1))}
                    className="col-span-2 h-11 rounded-xl bg-[#1A1A1F] hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-xs sm:text-sm border border-white/10 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                  >
                    ⌫ Xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="col-span-3 h-11 rounded-xl bg-[#1A1A1F] hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-xs sm:text-sm border border-white/10 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                  >
                    Xóa hết
                  </button>
                </div>

                <p className="text-[11px] text-[#A9A6A0] pt-1">
                  Mẹo: Chạm vào ô tìm kiếm để bật bàn phím điện thoại, hoặc bấm nút{' '}
                  <span className="text-[#F2B544] font-semibold">&123 / Dấu</span> để gõ tiếng Việt có dấu (à, á, ả, ã, ạ...).
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: SEARCH RESULTS GRID (Rap Nha tv-08-tim-kiem.jpg) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#F4F1EA]">
                  {searchQuery.trim()
                    ? `Kết quả hàng đầu • "${searchQuery.trim()}" (${searchResults.length} phim)`
                    : 'Kết quả hàng đầu • Phim mới đề xuất'}
                </h2>
                <div className="flex items-center gap-1.5">
                  {TV_SOURCE_OPTIONS.map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => handleSelectMovieSource(src.id)}
                      className={`px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer ${
                        movieSource === src.id
                          ? 'bg-[#F2B544] text-[#0E0E10]'
                          : 'bg-[#1A1A1F] text-[#C9C5BD] border border-white/10'
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-10">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenMovieDetail(item)}
                    className="group text-left rounded-2xl overflow-hidden bg-[#1A1A1F] border-2 border-transparent hover:border-[#F2B544] focus:border-[#F2B544] transition-all cursor-pointer"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#121216]">
                      <img
                        src={item.background || item.poster}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#F2B544] text-[#0E0E10] font-extrabold text-[10px]">
                        {item.episodeCurrent || item.quality || 'HD'}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <div className="font-bold text-xs sm:text-sm text-[#F4F1EA] truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#A9A6A0] truncate">
                        {item.type === 'series' ? 'Phim bộ' : 'Phim lẻ'} • {item.year || '2026'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: HOME SCREEN (RAP NHA tv-02-trang-chu.jpg & tv-03-top-10.jpg)
           =================================================================== */}
        {!selectedDetailItem && activeTab === 'home' && (
          <div className="relative min-h-full w-full pb-14">
            {/* HERO BANNER */}
            {currentHero && (
              <div className="relative w-full min-h-[340px] sm:min-h-[430px] flex items-end px-6 sm:px-12 pt-8 pb-6 overflow-hidden">
                {/* Right-aligned full-bleed backdrop with TMDB 4K UHD Progressive Resolution */}
                <div className="absolute inset-0 pointer-events-none z-0">
                  <CinemaHeroBackdrop item={currentHero} isTvMode={true} />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(90deg, #0E0E10 0%, rgba(14,14,16,0.92) 38%, rgba(14,14,16,0.35) 75%, rgba(14,14,16,0.15) 100%), linear-gradient(180deg, rgba(14,14,16,0.2) 0%, rgba(14,14,16,0.5) 65%, #0E0E10 100%)',
                    }}
                  />
                </div>

                <div className="relative z-10 max-w-2xl space-y-3">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#F2B544]">
                    MỚI CẬP NHẬT • {currentHero.episodeCurrent || 'FHD'}
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold text-[#F4F1EA] tracking-tight leading-tight line-clamp-2">
                    {currentHero.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[#C9C5BD]">
                    <span>{currentHero.year || '2026'}</span>
                    <span>•</span>
                    <span>45 phút/tập</span>
                    <span className="px-2 py-0.5 rounded border border-white/30 text-xs font-bold text-[#F4F1EA]">
                      {currentHero.quality || 'HD'}
                    </span>
                    <span>{currentHero.lang || 'Vietsub + Thuyết Minh'}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#C9C5BD] line-clamp-2 leading-relaxed">
                    {currentHero.description ||
                      'Siêu phẩm điện ảnh mới cập nhật với chất lượng hình ảnh sắc nét Full HD, âm thanh sống động.'}
                  </p>

                  {/* Hero CTA Buttons (Rap Nha tv-02-trang-chu.jpg style) */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePlayEpisode(currentHero, 0, 1)}
                      className="px-6 py-3 rounded-2xl bg-[#F4F1EA] hover:bg-white text-[#0E0E10] font-extrabold text-sm ring-2 ring-[#F2B544] ring-offset-2 ring-offset-[#0E0E10] flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                    >
                      <span>▶</span>
                      <span>Xem ngay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenMovieDetail(currentHero)}
                      className="px-5 py-3 rounded-2xl bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-sm border border-white/10 flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                    >
                      <span>ⓘ</span>
                      <span>Thông tin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWatchlist(currentHero)}
                      className="px-5 py-3 rounded-2xl bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] font-semibold text-sm border border-white/10 flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                    >
                      <span>{isSavedInWatchlist(currentHero.id) ? '✓' : '+'}</span>
                      <span>Danh sách</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFeaturedIdx((prev) => (prev + 1) % Math.max(1, featuredItems.length))
                      }
                      className="w-11 h-11 rounded-full bg-[#1E1E24]/90 hover:bg-[#2A2A32] text-[#F4F1EA] border border-white/10 flex items-center justify-center text-base font-bold cursor-pointer focus:ring-2 focus:ring-[#F2B544]"
                      title="Phim nổi bật tiếp theo"
                    >
                      ›
                    </button>
                  </div>

                  {/* Hero Carousel Indicator Bars */}
                  {featuredItems.length > 1 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      {featuredItems.map((it, idx) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setFeaturedIdx(idx)}
                          className={`h-1 rounded-full transition-all cursor-pointer ${
                            idx === featuredIdx
                              ? 'w-6 bg-[#F4F1EA]'
                              : 'w-2.5 bg-white/25 hover:bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTENT ROWS */}
            <div className="px-6 sm:px-12 space-y-8">
              {/* MOVIE SOURCE SELECTOR BAR ON TV HOME */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-xs sm:text-sm font-extrabold text-[#F2B544] shrink-0">
                  🖧 Nguồn Phim:
                </span>
                {TV_SOURCE_OPTIONS.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectMovieSource(src.id)}
                    className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                      movieSource === src.id
                        ? 'bg-[#F2B544] text-[#0E0E10] shadow-md'
                        : 'bg-[#1A1A1F] text-[#C9C5BD] hover:text-white border border-white/10'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>

              {/* 1. XEM TIẾP (Continue Watching — Rap Nha tv-02-trang-chu.jpg) */}
              {watchHistory.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#F4F1EA]">
                    Xem tiếp
                  </h2>
                  <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                    {watchHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          handleOpenMovieDetail({
                            id: item.id,
                            type: item.type,
                            name: item.name,
                            poster: item.poster,
                            background: item.background,
                          })
                        }
                        className="group w-60 sm:w-68 shrink-0 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#1E1E24] border-2 border-transparent group-hover:border-[#F2B544] group-focus:border-[#F2B544] transition-all">
                          <img
                            src={item.background || item.poster}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {/* Bottom Gold Progress Bar */}
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                            <div
                              className="h-full bg-[#F2B544]"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className="font-bold text-sm text-[#F4F1EA] truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-[#A9A6A0]">
                            {item.episodeName} • còn {item.remainingMinutes} phút
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 2. ALL SHELVES (INCLUDING TOP 10 WITH GIANT GOLD OUTLINED NUMBERS — tv-03-top-10.jpg) */}
              {shelves.map((shelf) => (
                <section key={shelf.id} className="space-y-3">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#F4F1EA]">
                    {shelf.title}
                  </h2>

                  {shelf.isLoading ? (
                    <div className="flex items-center gap-4 overflow-hidden">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div
                          key={n}
                          className="w-40 sm:w-44 aspect-[2/3] rounded-2xl bg-[#1E1E24] animate-pulse shrink-0"
                        />
                      ))}
                    </div>
                  ) : shelf.isTop10 ? (
                    /* TOP 10 ROW WITH GIANT GOLD OUTLINED RANK NUMBERS (tv-03-top-10.jpg) */
                    <div className="flex items-end gap-5 overflow-x-auto pb-3 pt-1 no-scrollbar">
                      {shelf.items.slice(0, 10).map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenMovieDetail(item)}
                          onMouseEnter={() => setFeaturedIdx(idx % Math.max(1, featuredItems.length))}
                          className="group relative flex items-end shrink-0 text-left cursor-pointer focus:outline-none"
                        >
                          {/* Giant Outlined Gold Rank Number */}
                          <span
                            className="font-black text-7xl sm:text-8xl leading-none select-none -mr-3 z-0 transition-transform group-hover:scale-105"
                            style={{
                              color: 'transparent',
                              WebkitTextStroke: '2.5px #F2B544',
                            }}
                          >
                            {idx + 1}
                          </span>

                          {/* Vertical Poster Card */}
                          <div className="relative z-10 w-32 sm:w-36 aspect-[2/3] rounded-2xl overflow-hidden bg-[#1E1E24] border-2 border-transparent group-hover:border-[#F2B544] group-focus:border-[#F2B544] shadow-xl transition-all group-hover:-translate-y-1">
                            <img
                              src={item.poster || item.background}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#F2B544] text-[#0E0E10] font-extrabold text-[10px]">
                              {item.episodeCurrent || item.quality || 'HD'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* STANDARD LANDSCAPE / POSTER SHELF */
                    <div className="flex items-center gap-4 overflow-x-auto pb-3 no-scrollbar">
                      {shelf.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenMovieDetail(item)}
                          className="group w-52 sm:w-60 shrink-0 text-left cursor-pointer focus:outline-none"
                        >
                          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#1E1E24] border-2 border-transparent group-hover:border-[#F2B544] group-focus:border-[#F2B544] transition-all">
                            <img
                              src={item.background || item.poster}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#F2B544] text-[#0E0E10] font-extrabold text-[10px]">
                              {item.episodeCurrent || item.quality || 'HD'}
                            </span>
                          </div>
                          <div className="pt-2">
                            <div className="font-bold text-sm text-[#F4F1EA] truncate group-hover:text-[#F2B544]">
                              {item.name}
                            </div>
                            <div className="text-xs text-[#A9A6A0] truncate">
                              {item.year || '2026'} • {item.lang || 'Vietsub'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3 & 5: MOVIES & EXPLORE (GENRES / COUNTRIES / CATEGORIES)
           =================================================================== */}
        {!selectedDetailItem && (activeTab === 'movies' || activeTab === 'explore') && (
          <div className="min-h-full w-full px-6 sm:px-10 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#F2B544]">
                  {activeTab === 'movies' ? 'KHO PHIM ĐIỆN ẢNH & PHIM BỘ' : 'KHÁM PHÁ THEO THỂ LOẠI & QUỐC GIA'}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">
                  {activeTab === 'movies' ? 'Tuyển Tập Phim Mới 2026' : 'Bộ Lọc Đa Chiều'}
                </h1>
              </div>

              {/* Source Provider Selector */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-extrabold text-[#F2B544] shrink-0">
                  🖧 Nguồn:
                </span>
                {TV_SOURCE_OPTIONS.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectMovieSource(src.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold shrink-0 cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                      movieSource === src.id
                        ? 'bg-[#F2B544] text-[#0E0E10]'
                        : 'bg-[#1A1A1F] text-[#C9C5BD] border border-white/10'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category / Genre / Country Pills */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'cat_moi_cap_nhat', name: '🔥 Mới Cập Nhật' },
                  { id: 'cat_phim_bo', name: '📺 Phim Bộ' },
                  { id: 'cat_phim_le', name: '🎬 Phim Lẻ' },
                  { id: 'cat_phim_le_thuyet_minh', name: '🎙️ Thuyết Minh' },
                  { id: 'cat_long_tieng', name: '🔊 Lồng Tiếng' },
                  { id: 'cat_hoat_hinh', name: '✨ Hoạt Hình' },
                  ...GENRE_CHIPS,
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setActiveCategoryFilter(chip.id);
                      setCategoryPage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer ${
                      activeCategoryFilter === chip.id
                        ? 'bg-[#F2B544] text-[#0E0E10] shadow-lg'
                        : 'bg-[#1A1A1F] text-[#C9C5BD] hover:text-white border border-white/10'
                    }`}
                  >
                    {chip.name}
                  </button>
                ))}
              </div>

              {activeTab === 'explore' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {COUNTRY_CHIPS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryFilter(c.id);
                        setCategoryPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                        activeCategoryFilter === c.id
                          ? 'bg-[#F2B544] text-[#0E0E10]'
                          : 'bg-[#16161B] text-[#A9A6A0] hover:text-white border border-white/10'
                      }`}
                    >
                      🌏 {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Movie Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
              {categoryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenMovieDetail(item)}
                  className="group text-left rounded-2xl overflow-hidden bg-[#1A1A1F] border-2 border-transparent hover:border-[#F2B544] focus:border-[#F2B544] transition-all cursor-pointer"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#121216]">
                    <img
                      src={item.poster || item.background}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#F2B544] text-[#0E0E10] font-extrabold text-[10px]">
                      {item.episodeCurrent || item.quality || 'HD'}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <div className="font-bold text-xs sm:text-sm text-[#F4F1EA] truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-[#A9A6A0] truncate">
                      {item.year || '2026'} • {item.lang || 'Vietsub'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-center pb-12">
              <button
                type="button"
                disabled={isLoadingCategory}
                onClick={() => setCategoryPage((p) => p + 1)}
                className="px-6 py-3 rounded-full bg-[#F2B544] hover:bg-[#f5c25d] text-[#0E0E10] font-extrabold text-sm shadow-lg cursor-pointer"
              >
                {isLoadingCategory ? 'Đang tải thêm phim...' : '+ Tải thêm phim mới'}
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 6: MY LIST & WATCH HISTORY
           =================================================================== */}
        {!selectedDetailItem && activeTab === 'mylist' && (
          <div className="min-h-full w-full px-6 sm:px-10 py-6 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#3A6073] text-white font-black text-2xl flex items-center justify-center border-2 border-[#F2B544]">
                  T
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-[#F4F1EA]">Hồ sơ của tôi</h1>
                  <p className="text-xs sm:text-sm text-[#A9A6A0]">
                    Đã lưu {watchlist.length} phim • Đã xem {watchHistory.length} phim
                  </p>
                </div>
              </div>
              {!isLockedTvApk && (
                <button
                  type="button"
                  onClick={onSwitchToWebMode}
                  className="px-4 py-2.5 rounded-full bg-[#1E1E24] hover:bg-[#F2B544] text-[#F2B544] hover:text-[#0E0E10] border border-[#F2B544]/40 text-xs sm:text-sm font-bold cursor-pointer"
                >
                  🌐 Về Giao Diện Web
                </button>
              )}
            </div>

            {/* Watchlist */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#F4F1EA]">Danh sách của tôi</h2>
              {watchlist.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1A1A1F] border border-white/5 text-center text-sm text-[#A9A6A0]">
                  Chưa có phim nào trong danh sách. Hãy bấm nút <b>+ Danh sách</b> trên phim bạn yêu thích!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {watchlist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenMovieDetail(item)}
                      className="group text-left rounded-2xl overflow-hidden bg-[#1A1A1F] border-2 border-transparent hover:border-[#F2B544] cursor-pointer"
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden">
                        <img
                          src={item.poster || item.background}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2.5 font-bold text-xs sm:text-sm text-[#F4F1EA] truncate">
                        {item.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Watch History */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#F4F1EA]">Lịch sử xem</h2>
                {watchHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWatchHistory([]);
                      localStorage.removeItem(TV_HISTORY_KEY);
                      onShowToast('🗑️ Đã xóa lịch sử xem');
                    }}
                    className="text-xs text-[#A9A6A0] hover:text-red-400 cursor-pointer"
                  >
                    Xóa toàn bộ lịch sử
                  </button>
                )}
              </div>
              {watchHistory.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#1A1A1F] border border-white/5 text-center text-sm text-[#A9A6A0]">
                  Lịch sử xem trống.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {watchHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-[#1A1A1F] border border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenMovieDetail({
                            id: h.id,
                            type: h.type,
                            name: h.name,
                            poster: h.poster,
                            background: h.background,
                          })
                        }
                        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className="relative w-28 aspect-video rounded-xl overflow-hidden bg-black shrink-0">
                          <img
                            src={h.background || h.poster}
                            alt={h.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                            <div
                              className="h-full bg-[#F2B544]"
                              style={{ width: `${h.progressPercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-[#F4F1EA] truncate">{h.name}</div>
                          <div className="text-xs text-[#A9A6A0]">
                            {h.episodeName} • còn {h.remainingMinutes} phút
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWatchHistory((prev) => {
                            const next = prev.filter((x) => x.id !== h.id);
                            localStorage.setItem(TV_HISTORY_KEY, JSON.stringify(next));
                            return next;
                          });
                        }}
                        className="p-2 text-[#A9A6A0] hover:text-red-400 cursor-pointer"
                        title="Xóa"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 7: SETTINGS & SOURCE CONFIGURATION
           =================================================================== */}
        {!selectedDetailItem && activeTab === 'settings' && (
          <div className="min-h-full w-full px-6 sm:px-10 py-8 max-w-3xl space-y-6">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#F2B544]">
                CÀI ĐẶT HỆ THỐNG PHIM.TNUI ANDROID TV
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F4F1EA]">
                Tuỳ Chỉnh Nguồn Phát & Cập Nhật
              </h1>
            </div>

            {/* Source Selector Card in TV Settings */}
            <div className="p-5 rounded-2xl bg-[#1A1A1F] border border-white/10 space-y-3">
              <div className="font-extrabold text-base text-[#F4F1EA]">
                🖧 Chọn Nguồn Phim Mặc Định
              </div>
              <div className="flex flex-wrap gap-2">
                {TV_SOURCE_OPTIONS.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectMovieSource(src.id)}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer focus:ring-2 focus:ring-[#F2B544] ${
                      movieSource === src.id
                        ? 'bg-[#F2B544] text-[#0E0E10]'
                        : 'bg-[#25252E] text-[#C9C5BD]'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isLockedTvApk && (
                <button
                  type="button"
                  onClick={onSwitchToWebMode}
                  className="p-5 rounded-2xl bg-[#1A1A1F] hover:bg-[#25252D] border border-[#F2B544]/40 text-left space-y-2 cursor-pointer"
                >
                  <div className="text-2xl">🌐</div>
                  <div className="font-extrabold text-base text-[#F4F1EA]">
                    Về Giao Diện Web Đầy Đủ
                  </div>
                  <p className="text-xs text-[#A9A6A0]">
                    Chuyển về giao diện Web trên trình duyệt máy tính / điện thoại.
                  </p>
                </button>
              )}

              <button
                type="button"
                onClick={onCheckUpdates}
                className="p-5 rounded-2xl bg-[#1A1A1F] hover:bg-[#25252D] border border-white/10 text-left space-y-2 cursor-pointer"
              >
                <div className="text-2xl">🚀</div>
                <div className="font-extrabold text-base text-[#F4F1EA]">
                  Tải APK & Kiểm Tra Cập Nhật
                </div>
                <p className="text-xs text-[#A9A6A0]">
                  Tải trực tiếp gói cài đặt PHIMTNUI-MobiTV.apk và PHIMTNUI-AndroidTV.apk mới nhất.
                </p>
              </button>

              <button
                type="button"
                onClick={onOpenClassicAddon}
                className="p-5 rounded-2xl bg-[#1A1A1F] hover:bg-[#25252D] border border-white/10 text-left space-y-2 cursor-pointer"
              >
                <div className="text-2xl">🧩</div>
                <div className="font-extrabold text-base text-[#F4F1EA]">
                  Cấu Hình Stremio Addon Manifest
                </div>
                <p className="text-xs text-[#A9A6A0]">
                  Sao chép đường dẫn Manifest để tích hợp vào Stremio / Kodi nếu cần.
                </p>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
