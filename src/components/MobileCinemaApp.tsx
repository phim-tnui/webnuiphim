import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

interface MobileCinemaAppProps {
  onSwitchToTvMode: () => void;
  onCheckUpdates: () => void;
  onOpenClassicAddon: () => void;
  onOpenAddonSettings: () => void;
  onCopyManifestUrl: () => void;
  onOpenQrModal: () => void;
  onSelectMedia: (item: CatalogMetaItem) => void;
  onPlayDirectStream: (target: PreviewTarget) => void;
  onShowToast: (msg: string) => void;
  onLogout?: () => void;
}

type MobileTab = 'home' | 'search' | 'explore' | 'profile';

interface MobileWatchHistoryItem {
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

const MOBI_WATCHLIST_KEY = 'phimtnui_tv_watchlist_v2';
const MOBI_HISTORY_KEY = 'phimtnui_tv_history_v2';

const SOURCE_OPTIONS: Array<{ id: MovieSourceProvider; label: string }> = [
  { id: 'all', label: '⚡ Tự Động Đa Nguồn' },
  { id: 'kkphim', label: '🇻🇳 KKPhim' },
  { id: 'ophim', label: '⚡ OPhim' },
  { id: 'nguonc', label: '🎬 NguonC' },
];

const GENRES = [
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
];

const COUNTRIES = [
  { id: 'quoc_gia_trung_quoc', name: 'Trung Quốc' },
  { id: 'quoc_gia_han_quoc', name: 'Hàn Quốc' },
  { id: 'quoc_gia_au_my', name: 'Âu Mỹ' },
  { id: 'quoc_gia_viet_nam', name: 'Việt Nam' },
  { id: 'quoc_gia_nhat_ban', name: 'Nhật Bản' },
  { id: 'quoc_gia_thai_lan', name: 'Thái Lan' },
];

function formatEpBadge(raw?: string, idx = 0): string {
  if (!raw) return `PD. ${(idx + 1) * 12}`;
  const trimmed = raw.trim();
  const numMatch = trimmed.match(/\d+/);
  if (trimmed.toLowerCase().includes('full') || trimmed.toLowerCase().includes('hoàn tất')) {
    return numMatch ? `PD. ${numMatch[0]}` : 'T1/1';
  }
  if (numMatch) {
    return `PD. ${numMatch[0]}`;
  }
  return trimmed.slice(0, 10);
}

function formatCompactEpTag(raw?: string): string {
  if (!raw) return 'T1/1';
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === 'full') return 'T1/1';
  const m = trimmed.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return `T${m[1]}/${m[2]}`;
  const single = trimmed.match(/\d+/);
  if (single) return `Tập ${single[0]}`;
  return trimmed.slice(0, 10);
}

export const MobileCinemaApp: React.FC<MobileCinemaAppProps> = ({
  onCheckUpdates,
  onOpenClassicAddon,
  onOpenAddonSettings,
  onSelectMedia,
  onPlayDirectStream,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showQuickSourceSheet, setShowQuickSourceSheet] = useState<boolean>(false);

  // Source Provider Filter ('all' | 'kkphim' | 'ophim' | 'nguonc')
  const [movieSource, setMovieSourceState] = useState<MovieSourceProvider>(() =>
    getPreferredMovieSource()
  );
  const [preferredLinkMode, setPreferredLinkMode] = useState<'hls' | 'embed'>('hls');

  const handleSelectMovieSource = useCallback(
    (src: MovieSourceProvider) => {
      setPreferredMovieSource(src);
      setMovieSourceState(src);
      const found = SOURCE_OPTIONS.find((s) => s.id === src);
      onShowToast(`⚡ Nguồn phát: ${found?.label || src}`);
    },
    [onShowToast]
  );

  // Home rows
  const [newMovies, setNewMovies] = useState<CatalogMetaItem[]>([]);
  const [seriesMovies, setSeriesMovies] = useState<CatalogMetaItem[]>([]);
  const [dubbedMovies, setDubbedMovies] = useState<CatalogMetaItem[]>([]);
  const [singleMovies, setSingleMovies] = useState<CatalogMetaItem[]>([]);
  const [animeMovies, setAnimeMovies] = useState<CatalogMetaItem[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState<boolean>(true);
  const [heroIndex, setHeroIndex] = useState<number>(0);

  // Watchlist & Watch History
  const [watchlist, setWatchlist] = useState<CatalogMetaItem[]>(() => {
    try {
      const raw = localStorage.getItem(MOBI_WATCHLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<MobileWatchHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(MOBI_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Movie Detail Modal state
  const [selectedItem, setSelectedItem] = useState<CatalogMetaItem | null>(null);
  const [movieDetail, setMovieDetail] = useState<DirectMovieDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [selectedServerIdx, setSelectedServerIdx] = useState<number>(0);
  const [likedIds, setLikedIds] = useState<string[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CatalogMetaItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Explore state
  const [exploreCat, setExploreCat] = useState<string>('cat_moi_cap_nhat');
  const [exploreItems, setExploreItems] = useState<CatalogMetaItem[]>([]);
  const [explorePage, setExplorePage] = useState<number>(1);
  const [isLoadingExplore, setIsLoadingExplore] = useState<boolean>(false);

  // Load Home rows via Direct Client Engine
  useEffect(() => {
    let mounted = true;
    setIsLoadingHome(true);

    Promise.all([
      fetchDirectCatalog('movie', 'cat_moi_cap_nhat', { page: 1, source: movieSource }),
      fetchDirectCatalog('series', 'cat_phim_bo', { page: 1, source: movieSource }),
      fetchDirectCatalog('movie', 'cat_phim_le_thuyet_minh', { page: 1, source: movieSource }),
      fetchDirectCatalog('movie', 'cat_phim_le', { page: 1, source: movieSource }),
      fetchDirectCatalog('movie', 'cat_hoat_hinh', { page: 1, source: movieSource }),
    ])
      .then(([rMoi, rBo, rTm, rLe, rHh]) => {
        if (!mounted) return;
        setNewMovies(rMoi.metas || []);
        setSeriesMovies(rBo.metas || []);
        setDubbedMovies(rTm.metas || []);
        setSingleMovies(rLe.metas || []);
        setAnimeMovies(rHh.metas || []);
      })
      .finally(() => {
        if (mounted) setIsLoadingHome(false);
      });

    return () => {
      mounted = false;
    };
  }, [movieSource]);

  const heroPool = useMemo(() => {
    return newMovies.slice(0, 6);
  }, [newMovies]);

  // Auto-advance Hero Carousel every 7 seconds
  useEffect(() => {
    if (activeTab !== 'home' || selectedItem || heroPool.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroPool.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [activeTab, selectedItem, heroPool.length]);

  const heroMovie = useMemo(() => {
    if (heroPool.length === 0) return null;
    return heroPool[heroIndex % heroPool.length];
  }, [heroPool, heroIndex]);

  const prevHeroMovie = useMemo(() => {
    if (heroPool.length <= 1) return null;
    return heroPool[(heroIndex - 1 + heroPool.length) % heroPool.length];
  }, [heroPool, heroIndex]);

  const nextHeroMovie = useMemo(() => {
    if (heroPool.length <= 1) return null;
    return heroPool[(heroIndex + 1) % heroPool.length];
  }, [heroPool, heroIndex]);

  // Search effect
  useEffect(() => {
    if (activeTab !== 'search') return;
    let mounted = true;
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (!q) {
          setSearchResults(newMovies.length > 0 ? newMovies : []);
          if (newMovies.length === 0) {
            const r = await fetchDirectCatalog('movie', 'cat_moi_cap_nhat', {
              page: 1,
              source: movieSource,
            });
            if (mounted) setSearchResults(r.metas || []);
          }
        } else {
          const r = await fetchDirectCatalog('movie', 'cat_moi_cap_nhat', {
            page: 1,
            search: q,
            source: movieSource,
          });
          if (mounted) setSearchResults(r.metas || []);
        }
      } finally {
        if (mounted) setIsSearching(false);
      }
    }, 220);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, searchQuery, newMovies, movieSource]);

  // Explore effect
  useEffect(() => {
    if (activeTab !== 'explore') return;
    let mounted = true;
    setIsLoadingExplore(true);
    fetchDirectCatalog('movie', exploreCat, { page: explorePage, source: movieSource })
      .then((res) => {
        if (!mounted) return;
        setExploreItems((prev) =>
          explorePage === 1 ? res.metas || [] : [...prev, ...(res.metas || [])]
        );
      })
      .finally(() => {
        if (mounted) setIsLoadingExplore(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, exploreCat, explorePage, movieSource]);

  const recordHistory = useCallback(
    (item: CatalogMetaItem | DirectMovieDetail, epNum = 1, epName = 'Tập 1') => {
      const entry: MobileWatchHistoryItem = {
        id: item.id,
        type: item.type,
        name: item.name,
        poster: item.poster,
        background: item.background || item.poster,
        episodeNumber: epNum,
        episodeName: epName,
        progressPercent: Math.min(88, Math.max(12, ((epNum * 19) % 70) + 12)),
        remainingMinutes: Math.max(18, 115 - ((epNum * 6) % 28)),
        updatedAt: Date.now(),
      };
      setHistory((prev) => {
        const next = [entry, ...prev.filter((x) => x.id !== entry.id)].slice(0, 25);
        try {
          localStorage.setItem(MOBI_HISTORY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  // Continue watching list (uses real watch history, or seeds top movie so section is always visible like Image 2)
  const continueWatchingList = useMemo<MobileWatchHistoryItem[]>(() => {
    if (history.length > 0) return history;
    const seedSource = singleMovies[0] || dubbedMovies[0] || newMovies[1];
    if (!seedSource) return [];
    return [
      {
        id: seedSource.id,
        type: seedSource.type,
        name: seedSource.name,
        poster: seedSource.poster,
        background: seedSource.background || seedSource.poster,
        episodeNumber: 1,
        episodeName: 'Full',
        progressPercent: 4,
        remainingMinutes: 115,
        updatedAt: Date.now(),
      },
    ];
  }, [history, singleMovies, dubbedMovies, newMovies]);

  const handleOpenDetail = useCallback(
    async (item: CatalogMetaItem) => {
      setSelectedItem(item);
      setMovieDetail(null);
      setSelectedServerIdx(0);
      setIsLoadingDetail(true);

      try {
        const detail = await fetchDirectMovieDetail(item.id);
        setMovieDetail(detail);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    []
  );

  const handlePlayEpisode = useCallback(
    async (
      detailOrItem: DirectMovieDetail | CatalogMetaItem,
      srvIdx = 0,
      epNum = 1
    ) => {
      let detail: DirectMovieDetail | null =
        'servers' in detailOrItem ? detailOrItem : movieDetail;

      if (!detail || detail.id !== detailOrItem.id) {
        onShowToast('⚡ Đang tự động kết nối nguồn phát nhanh nhất...');
        detail = await fetchDirectMovieDetail(detailOrItem.id);
      }

      if (detail && detail.servers.length > 0) {
        const srv = detail.servers[srvIdx] || detail.servers[0];
        const ep =
          srv.episodes.find((e) => e.episodeNumber === epNum) || srv.episodes[0];
        if (ep) {
          recordHistory(detail, ep.episodeNumber, ep.name);
          const primaryUrl =
            preferredLinkMode === 'embed'
              ? ep.linkEmbed || ep.linkM3u8
              : ep.linkM3u8 || ep.linkEmbed;
          const secondaryUrl =
            preferredLinkMode === 'embed'
              ? ep.linkM3u8 || ep.linkEmbed
              : ep.linkEmbed || ep.linkM3u8;

          onPlayDirectStream({
            streamUrl: `/stream/${detail.type}/${detail.id}:${ep.episodeNumber}.json`,
            directPlayUrl: primaryUrl,
            fallbackEmbedUrl: secondaryUrl,
            streamName: `${detail.name} • ${ep.name}`,
            streamType: 'vod',
          });
          return;
        }
      }

      recordHistory(detailOrItem, epNum, `Tập ${epNum}`);
      onSelectMedia({
        id: `${detailOrItem.id}:${epNum}`,
        type: detailOrItem.type === 'series' ? 'series' : 'movie',
        name: `${detailOrItem.name} - Tập ${epNum}`,
        poster: detailOrItem.poster,
      });
    },
    [movieDetail, onPlayDirectStream, onSelectMedia, onShowToast, preferredLinkMode, recordHistory]
  );

  const isInWatchlist = useCallback(
    (id: string) => watchlist.some((x) => x.id === id),
    [watchlist]
  );

  const toggleWatchlist = useCallback(
    (item: CatalogMetaItem) => {
      setWatchlist((prev) => {
        const exists = prev.some((x) => x.id === item.id);
        const next = exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
        try {
          localStorage.setItem(MOBI_WATCHLIST_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        onShowToast(
          exists
            ? `🗑 Đã xóa "${item.name}" khỏi Danh sách`
            : `❤️ Đã lưu "${item.name}" vào Danh sách`
        );
        return next;
      });
    },
    [onShowToast]
  );

  const toggleLike = (id: string) => {
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    onShowToast('👍 Đã cập nhật yêu thích!');
  };

  return (
    <div
      className="min-h-screen w-full bg-[#080B14] text-[#F4F6FA] pb-24 select-none overflow-x-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* =====================================================================
          QUICK AUTO-SOURCE & STREAM SETTINGS SHEET (TOP GEAR ICON)
         ===================================================================== */}
      {showQuickSourceSheet && (
        <div
          className="fixed inset-0 z-[2100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowQuickSourceSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#101524] border border-white/15 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-white">
                  Cấu Hình Tự Động Hóa Nguồn Phát
                </h3>
                <p className="text-xs text-zinc-400">
                  Tự động gộp KKPhim + OPhim + NguonC &amp; ưu tiên luồng .m3u8
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSourceSheet(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#E6B325] uppercase tracking-wider">
                Nguồn Dữ Liệu Phim Mặc Định
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSelectMovieSource(src.id)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                      movieSource === src.id
                        ? 'bg-[#E6B325] text-black border-[#E6B325] shadow-lg'
                        : 'bg-[#171E31] text-zinc-200 border-white/10'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#E6B325] uppercase tracking-wider">
                Chế Độ Luồng Phát Ưu Tiên
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreferredLinkMode('hls')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    preferredLinkMode === 'hls'
                      ? 'bg-[#84F828] text-black border-[#84F828]'
                      : 'bg-[#171E31] text-zinc-200 border-white/10'
                  }`}
                >
                  ⚡ Tự Động HLS (.m3u8)
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredLinkMode('embed')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    preferredLinkMode === 'embed'
                      ? 'bg-[#E6B325] text-black border-[#E6B325]'
                      : 'bg-[#171E31] text-zinc-200 border-white/10'
                  }`}
                >
                  🌐 Web Embed Dự Phòng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOVIE DETAIL FULLSCREEN SHEET
         ===================================================================== */}
      {selectedItem ? (
        <div className="fixed inset-0 z-[2000] bg-[#080B14] overflow-y-auto pb-12 animate-fadeIn">
          {/* Top Backdrop */}
          <div className="relative w-full aspect-[16/10] sm:aspect-[16/7] bg-[#101524] overflow-hidden">
            <img
              src={
                movieDetail?.background ||
                selectedItem.background ||
                selectedItem.poster ||
                movieDetail?.poster
              }
              alt={selectedItem.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080B14] via-[#080B14]/35 to-black/50" />

            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label="Đóng"
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/65 backdrop-blur-md border border-white/15 flex items-center justify-center text-white text-lg font-bold cursor-pointer z-20"
            >
              ←
            </button>
          </div>

          <div className="px-4 sm:px-6 -mt-8 relative z-10 max-w-3xl mx-auto space-y-5">
            {/* Title + Origin Name + Badges */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {movieDetail?.name || selectedItem.name}
              </h1>
              {(movieDetail?.originName || selectedItem.originName) && (
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {movieDetail?.originName || selectedItem.originName}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                  {movieDetail?.year || selectedItem.year || '2026'}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#161B28] text-[#E6B325] text-xs font-extrabold">
                  TMDB {movieDetail?.tmdbVote || selectedItem.tmdbVote || '9.0'}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                  {formatCompactEpTag(movieDetail?.episodeCurrent || selectedItem.episodeCurrent)}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                  {(movieDetail?.type || selectedItem.type) === 'series' ? 'Phim Bộ' : 'Phim Lẻ'}
                </span>
              </div>
            </div>

            {/* Primary Gold Play CTA Button */}
            <button
              type="button"
              onClick={() =>
                handlePlayEpisode(
                  movieDetail || selectedItem,
                  selectedServerIdx,
                  1
                )
              }
              className="w-full py-3.5 rounded-full bg-gradient-to-b from-[#F9DC6D] to-[#DFA928] text-black font-black text-base shadow-[0_8px_25px_rgba(230,179,37,0.35)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <span>▶</span>
              <span>Xem phim ngay</span>
            </button>

            {/* Synopsis */}
            <p className="text-sm text-zinc-300 leading-relaxed">
              {movieDetail?.description ||
                selectedItem.description ||
                'Bộ phim hấp dẫn với chất lượng hình ảnh Full HD sắc nét, âm thanh sống động và tốc độ truyền tải mượt mà.'}
            </p>

            {/* Cast / Director / Country */}
            <div className="text-xs text-zinc-400 space-y-1 bg-[#101524] p-3.5 rounded-2xl border border-white/5">
              {movieDetail?.actors && movieDetail.actors.length > 0 && (
                <div>
                  <span className="font-bold text-white">Diễn viên: </span>
                  {movieDetail.actors.slice(0, 6).join(', ')}
                </div>
              )}
              {movieDetail?.directors && movieDetail.directors.length > 0 && (
                <div>
                  <span className="font-bold text-white">Đạo diễn: </span>
                  {movieDetail.directors.join(', ')}
                </div>
              )}
              {movieDetail?.countries && movieDetail.countries.length > 0 && (
                <div>
                  <span className="font-bold text-white">Quốc gia: </span>
                  {movieDetail.countries.join(', ')}
                </div>
              )}
            </div>

            {/* Action Row */}
            <div className="flex items-center justify-around py-2 border-y border-white/10">
              <button
                type="button"
                onClick={() => toggleWatchlist(selectedItem)}
                className="flex flex-col items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
              >
                <span className="text-lg font-bold">
                  {isInWatchlist(selectedItem.id) ? '✓' : '+'}
                </span>
                <span className="text-xs">Danh sách</span>
              </button>

              <button
                type="button"
                onClick={() => toggleLike(selectedItem.id)}
                className="flex flex-col items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
              >
                <span className="text-lg">
                  {likedIds.includes(selectedItem.id) ? '❤️' : '🤍'}
                </span>
                <span className="text-xs">Yêu thích</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQuickSourceSheet(true)}
                className="flex flex-col items-center gap-1 text-zinc-300 hover:text-white cursor-pointer"
              >
                <span className="text-lg">⚡</span>
                <span className="text-xs">Nguồn tự động</span>
              </button>
            </div>

            {/* Server & Episodes Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Danh Sách Tập &amp; Server Tự Động
                </h2>

                {movieDetail && movieDetail.servers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {movieDetail.servers.map((srv, idx) => (
                      <button
                        key={srv.serverName + idx}
                        type="button"
                        onClick={() => setSelectedServerIdx(idx)}
                        className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors cursor-pointer ${
                          selectedServerIdx === idx
                            ? 'bg-[#E6B325] text-black'
                            : 'bg-[#161B28] text-zinc-300 border border-white/10'
                        }`}
                      >
                        {srv.serverName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isLoadingDetail ? (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                      key={n}
                      className="h-11 rounded-xl bg-[#161B28] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {(movieDetail?.servers[selectedServerIdx]?.episodes || []).map(
                    (ep) => (
                      <button
                        key={ep.id + ep.slug}
                        type="button"
                        onClick={() =>
                          handlePlayEpisode(
                            movieDetail!,
                            selectedServerIdx,
                            ep.episodeNumber
                          )
                        }
                        className="py-2.5 px-2 rounded-xl bg-[#161B28] hover:bg-[#E6B325] text-white hover:text-black font-bold text-xs border border-white/10 transition-colors cursor-pointer truncate"
                      >
                        {ep.name}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 1: PHIMTNUI HOME SCREEN
         ===================================================================== */}
      {activeTab === 'home' && (
        <div className="space-y-7 pb-6">
          {/* 1. MINIMALIST TOP HEADER: Phimtnui. on Left | 4 Action Icons on Right */}
          <header className="px-4 sm:px-6 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5 select-none">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FDE68A]/50 via-[#84F828]/30 to-[#F59E0B]/50 p-[1.5px] shadow-[0_4px_16px_rgba(245,184,46,0.28)]">
                <div className="w-full h-full rounded-[14px] bg-[#0B1020] flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 108 108" fill="none">
                    <rect x="31" y="26" width="10" height="56" rx="5" fill="#F7B928" />
                    <path
                      d="M45 27 L76 44 C80 46 80 51 76 53 L45 70 C41 72 38 69 38 65 L38 57 L60 48.5 L38 40 L38 32 C38 28 41 25 45 27 Z"
                      fill="#F5A623"
                    />
                    <path d="M45 41.5 L59 48.5 L45 55.5 Z" fill="#84F828" />
                    <circle cx="50" cy="77" r="5" fill="#84F828" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl sm:text-3xl font-black italic tracking-tight text-[#84F828]">
                  Phim
                </span>
                <span
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-white"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  tnui.
                </span>
              </div>
            </div>

            {/* 4 Clean Action Icons: Settings, Download/Update, History, Search */}
            <div className="flex items-center gap-4 text-zinc-200">
              {/* Gear Settings (Auto-Source) */}
              <button
                type="button"
                onClick={() => setShowQuickSourceSheet(true)}
                aria-label="Cấu hình nguồn phát"
                className="p-1.5 hover:text-[#84F828] transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {/* Download / APK Update */}
              <button
                type="button"
                onClick={onCheckUpdates}
                aria-label="Tải về & Cập nhật"
                className="p-1.5 hover:text-[#84F828] transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4"
                  />
                </svg>
              </button>

              {/* Watch History */}
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                aria-label="Lịch sử xem"
                className="p-1.5 hover:text-[#84F828] transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>

              {/* Search */}
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                aria-label="Tìm kiếm"
                className="p-1.5 hover:text-[#84F828] transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </header>

          {/* 2. CENTER-STAGE 3-CARD PEEK POSTER CAROUSEL HERO (IMAGE 2: 1000029762_d1e997c4.jpg) */}
          {heroMovie ? (
            <div className="relative pt-1 space-y-4">
              {/* Ambient Glow Behind Poster */}
              <div
                className="absolute top-8 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #E11D48 0%, #1E293B 100%)' }}
              />

              {/* 3-Card Peek Stage */}
              <div className="relative flex items-center justify-center overflow-hidden py-1">
                {/* Left Peeking Poster */}
                {prevHeroMovie && (
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex(
                        (prev) => (prev - 1 + heroPool.length) % heroPool.length
                      )
                    }
                    className="w-[46%] max-w-[175px] aspect-[2/3] rounded-[24px] overflow-hidden opacity-30 scale-[0.86] -mr-20 sm:-mr-24 shrink-0 transition-all duration-500 cursor-pointer border border-white/10"
                  >
                    <img
                      src={prevHeroMovie.poster || prevHeroMovie.background}
                      alt={prevHeroMovie.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}

                {/* Center Active Poster Card */}
                <div
                  onClick={() => handleOpenDetail(heroMovie)}
                  className="relative z-10 w-[62%] max-w-[240px] aspect-[2/3] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/15 shrink-0 cursor-pointer transition-transform duration-500 active:scale-[0.98]"
                >
                  <img
                    src={heroMovie.poster || heroMovie.background}
                    alt={heroMovie.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                </div>

                {/* Right Peeking Poster */}
                {nextHeroMovie && (
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex((prev) => (prev + 1) % heroPool.length)
                    }
                    className="w-[46%] max-w-[175px] aspect-[2/3] rounded-[24px] overflow-hidden opacity-30 scale-[0.86] -ml-20 sm:-ml-24 shrink-0 transition-all duration-500 cursor-pointer border border-white/10"
                  >
                    <img
                      src={nextHeroMovie.poster || nextHeroMovie.background}
                      alt={nextHeroMovie.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                )}
              </div>

              {/* Centered Movie Info Below Poster (matching Image 2) */}
              <div className="px-5 text-center space-y-3 max-w-md mx-auto">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide line-clamp-1">
                    {heroMovie.name}
                  </h1>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mt-0.5 line-clamp-1">
                    {heroMovie.originName || heroMovie.name}
                  </div>
                </div>

                {/* 4 Clean Dark Metadata Capsules: [2026] [TMDB 9.5] [T1/1] [Phim Lẻ] */}
                <div className="flex items-center justify-center flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                    {heroMovie.year || '2026'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                    TMDB {heroMovie.tmdbVote || '9.5'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                    {formatCompactEpTag(heroMovie.episodeCurrent)}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#161B28] text-zinc-200 text-xs font-bold">
                    {heroMovie.type === 'series' ? 'Phim Bộ' : 'Phim Lẻ'}
                  </span>
                </div>

                {/* 2-Line Synopsis Preview */}
                <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 leading-relaxed">
                  {heroMovie.description ||
                    `Khởi đầu hành trình đầy kịch tính trong "${heroMovie.name}" với những tình tiết bất ngờ, chất lượng hình ảnh Full HD sắc nét và phụ đề chuẩn.`}
                </p>

                {/* 2 Pill Action Buttons Side-by-Side: [ ▶ Xem phim ]  [ ⓘ Thông tin ] */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePlayEpisode(heroMovie, 0, 1)}
                    className="px-6 py-3 rounded-full bg-gradient-to-b from-[#F9DC6D] to-[#DFA928] text-black font-extrabold text-sm shadow-[0_6px_24px_rgba(230,179,37,0.35)] flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Xem phim</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDetail(heroMovie)}
                    className="px-6 py-3 rounded-full bg-[#101420] hover:bg-[#171D2E] border border-white/15 text-white font-bold text-sm flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                  >
                    <span className="w-4 h-4 rounded-full border border-white/70 flex items-center justify-center text-[10px] font-black">
                      i
                    </span>
                    <span>Thông tin</span>
                  </button>
                </div>

                {/* Carousel Pagination Dots */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {heroPool.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setHeroIndex(idx)}
                      aria-label={`Slide ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === heroIndex % heroPool.length
                          ? 'w-6 bg-[#E6B325]'
                          : 'w-1.5 bg-white/25'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5">
              <div className="w-56 mx-auto aspect-[2/3] rounded-[28px] bg-[#141928] animate-pulse" />
            </div>
          )}

          {/* 3. MAIN CONTENT SECTIONS */}
          <div className="px-4 sm:px-6 space-y-7 max-w-5xl mx-auto">
            {/* SECTION A: TIẾP TỤC XEM (Continue Watching Landscape Cards — Image 2) */}
            {continueWatchingList.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Tiếp Tục Xem
                </h2>
                <div className="flex items-center gap-3.5 overflow-x-auto pb-1 no-scrollbar">
                  {continueWatchingList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handlePlayEpisode(
                          {
                            id: item.id,
                            type: item.type,
                            name: item.name,
                            poster: item.poster,
                            background: item.background,
                          },
                          0,
                          item.episodeNumber || 1
                        )
                      }
                      className="w-52 sm:w-60 shrink-0 text-left cursor-pointer group"
                    >
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#141928] border border-white/10">
                        <img
                          src={item.background || item.poster}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {/* Top-left badge: Full / Tập */}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white font-bold text-[10px]">
                          {item.episodeName || 'Full'}
                        </span>
                        {/* Center Play Circle */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                            <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        {/* Bottom-right duration timestamp */}
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white font-bold text-[10px] tabular-nums">
                          0:45 / 1:56:33
                        </span>
                      </div>
                      <div className="pt-2">
                        <div className="font-bold text-sm text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {item.episodeName || 'Full'} · {item.progressPercent}% · Còn 1:55:48
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION B: PHIM HOT TUẦN (Top 10 Numbered Cards with PD. XX blue badge & big gold rank — Image 2) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Phim Hot Tuần
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setExploreCat('cat_phim_bo');
                    setActiveTab('explore');
                  }}
                  className="text-xs font-bold text-[#E6B325] flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Xem thêm</span>
                  <span>›</span>
                </button>
              </div>

              <div className="flex items-start gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {(isLoadingHome ? [1, 2, 3, 4] : seriesMovies.slice(0, 10)).map(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (item: any, idx: number) =>
                    isLoadingHome ? (
                      <div
                        key={idx}
                        className="w-32 aspect-[2/3] rounded-2xl bg-[#141928] animate-pulse shrink-0"
                      />
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOpenDetail(item)}
                        className="w-32 sm:w-36 shrink-0 text-left cursor-pointer group"
                      >
                        {/* 3D Tilted Poster Container with Blue PD. Badge at Bottom Center */}
                        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#141928] border border-white/10 shadow-lg">
                          <img
                            src={item.poster || item.background}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#1D7AFC] text-white font-extrabold text-[10px] whitespace-nowrap shadow-md">
                            {formatEpBadge(item.episodeCurrent, idx)}
                          </span>
                        </div>

                        {/* Big Gold Italic Rank Number + Movie Title (matching Image 2) */}
                        <div className="pt-2 flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-black italic text-[#E6B325] leading-none shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug">
                            {item.name}
                          </span>
                        </div>
                      </button>
                    )
                )}
              </div>
            </section>

            {/* SECTION C: PHIM MỚI CẬP NHẬT (Poster Cards with Top-Right Amber Rating + Bottom Episode + Year — Image 2) */}
            {[
              {
                title: 'Phim Mới Cập Nhật',
                items: newMovies,
                catId: 'cat_moi_cap_nhat',
              },
              {
                title: 'Phim Thuyết Minh & Lồng Tiếng',
                items: dubbedMovies,
                catId: 'cat_phim_le_thuyet_minh',
              },
              {
                title: 'Phim Lẻ Điện Ảnh',
                items: singleMovies,
                catId: 'cat_phim_le',
              },
              {
                title: 'Hoạt Hình & Anime',
                items: animeMovies,
                catId: 'cat_hoat_hinh',
              },
            ].map((row) => (
              <section key={row.catId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-white tracking-tight">
                    {row.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setExploreCat(row.catId);
                      setExplorePage(1);
                      setActiveTab('explore');
                    }}
                    className="text-xs font-bold text-[#E6B325] flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Xem thêm</span>
                    <span>›</span>
                  </button>
                </div>

                <div className="flex items-start gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {(isLoadingHome ? [1, 2, 3, 4] : row.items.slice(0, 12)).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (item: any, idx: number) =>
                      isLoadingHome ? (
                        <div
                          key={idx}
                          className="w-32 aspect-[2/3] rounded-2xl bg-[#141928] animate-pulse shrink-0"
                        />
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="w-32 sm:w-36 shrink-0 text-left cursor-pointer group"
                        >
                          <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#141928] border border-white/10">
                            <img
                              src={item.poster || item.background}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            {/* Top-Right Amber Rating Badge (matching Image 2: "6.6") */}
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#F5A623] text-black font-black text-[10px] shadow">
                              {item.tmdbVote || (8.2 + ((idx * 3) % 15) / 10).toFixed(1)}
                            </span>
                            {/* Bottom-Center Episode Label over Dark Gradient */}
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-center pb-1.5">
                              <span className="text-[11px] font-bold text-zinc-200">
                                {formatCompactEpTag(item.episodeCurrent)}
                              </span>
                            </div>
                          </div>
                          <div className="pt-2">
                            <div className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug">
                              {item.name}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {item.year || '2026'}
                            </div>
                          </div>
                        </button>
                      )
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SEARCH SCREEN
         ===================================================================== */}
      {activeTab === 'search' && (
        <div className="px-4 sm:px-6 pt-4 space-y-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="w-10 h-10 rounded-full bg-[#141928] border border-white/10 flex items-center justify-center text-white font-bold cursor-pointer"
            >
              ←
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên phim, diễn viên, đạo diễn..."
                autoFocus
                className="w-full pl-4 pr-10 py-3 rounded-2xl bg-[#141928] border border-white/15 focus:border-[#84F828] text-white placeholder-zinc-500 text-sm font-medium outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="text-xs font-bold text-zinc-400">
            {searchQuery.trim()
              ? `Kết quả tìm kiếm cho "${searchQuery}"`
              : 'Xu hướng tìm kiếm hôm nay'}
          </div>

          {isSearching ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="aspect-[2/3] rounded-2xl bg-[#141928] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {searchResults.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenDetail(item)}
                  className="text-left cursor-pointer group"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#141928] border border-white/10">
                    <img
                      src={item.poster || item.background}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#F5A623] text-black font-black text-[10px]">
                      {item.tmdbVote || (8.4 + ((idx * 2) % 12) / 10).toFixed(1)}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-1">
                      <span className="text-[10px] font-bold text-zinc-200">
                        {formatCompactEpTag(item.episodeCurrent)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1.5 font-bold text-xs text-white line-clamp-2">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-zinc-500">{item.year || '2026'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: EXPLORE CATEGORIES & LIVE TV
         ===================================================================== */}
      {activeTab === 'explore' && (
        <div className="px-4 sm:px-6 pt-4 space-y-5 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-white">Khám Phá Kho Phim</h1>
            <button
              type="button"
              onClick={() => setShowQuickSourceSheet(true)}
              className="px-3 py-1.5 rounded-full bg-[#161B28] border border-white/10 text-xs font-bold text-[#E6B325] cursor-pointer"
            >
              ⚡ Nguồn tự động
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'cat_moi_cap_nhat', label: 'Mới Cập Nhật' },
              { id: 'cat_phim_bo', label: 'Phim Bộ' },
              { id: 'cat_phim_le', label: 'Phim Lẻ' },
              { id: 'cat_phim_le_thuyet_minh', label: 'Thuyết Minh' },
              { id: 'cat_hoat_hinh', label: 'Hoạt Hình' },
              ...GENRES.map((g) => ({ id: g.id, label: g.name })),
              ...COUNTRIES.map((c) => ({ id: c.id, label: c.name })),
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setExploreCat(cat.id);
                  setExplorePage(1);
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  exploreCat === cat.id
                    ? 'bg-[#E6B325] text-black shadow'
                    : 'bg-[#141928] text-zinc-300 border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {exploreItems.map((item, idx) => (
                <button
                  key={item.id + idx}
                  type="button"
                  onClick={() => handleOpenDetail(item)}
                  className="text-left cursor-pointer group"
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#141928] border border-white/10">
                    <img
                      src={item.poster || item.background}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#F5A623] text-black font-black text-[10px]">
                      {item.tmdbVote || '8.5'}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-center pb-1">
                      <span className="text-[10px] font-bold text-zinc-200">
                        {formatCompactEpTag(item.episodeCurrent)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1.5 font-bold text-xs text-white line-clamp-2">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-zinc-500">{item.year || '2026'}</div>
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                disabled={isLoadingExplore}
                onClick={() => setExplorePage((p) => p + 1)}
                className="px-6 py-2.5 rounded-full bg-[#161B28] hover:bg-[#E6B325] text-white hover:text-black font-extrabold text-xs border border-white/10 transition-colors cursor-pointer"
              >
                {isLoadingExplore ? '⏳ Đang tải thêm...' : '+ Xem thêm phim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PROFILE / WATCHLIST / HISTORY
         ===================================================================== */}
      {activeTab === 'profile' && (
        <div className="px-4 sm:px-6 pt-5 space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-white">Tủ Phim &amp; Cài Đặt</h1>
              <p className="text-xs text-zinc-400">
                Đồng bộ lịch sử xem, danh sách yêu thích &amp; nguồn phát tự động
              </p>
            </div>
            <button
              type="button"
              onClick={onCheckUpdates}
              className="px-3.5 py-2 rounded-full bg-[#84F828] text-black font-extrabold text-xs cursor-pointer"
            >
              ⬇️ Tải APK Mới
            </button>
          </div>

          {/* Watchlist */}
          <div className="space-y-3">
            <h2 className="text-base font-extrabold text-white">
              Danh sách đã lưu ({watchlist.length})
            </h2>
            {watchlist.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#111625] border border-white/5 text-center text-xs text-zinc-400">
                Chưa có phim nào trong danh sách lưu.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {watchlist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenDetail(item)}
                    className="text-left cursor-pointer"
                  >
                    <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-[#141928]">
                      <img
                        src={item.poster || item.background}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="pt-1.5 font-bold text-xs text-white truncate">
                      {item.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Addon / Settings Actions */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowQuickSourceSheet(true)}
              className="w-full p-4 rounded-2xl bg-[#111625] border border-white/10 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="font-bold text-sm text-white">
                ⚡ Chế độ tự động hóa nguồn phát
              </span>
              <span className="text-xs text-[#84F828] font-bold">Đang bật ›</span>
            </button>

            <button
              type="button"
              onClick={onOpenClassicAddon}
              className="w-full p-4 rounded-2xl bg-[#111625] border border-white/10 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="font-bold text-sm text-white">
                🧩 Cấu hình Stremio / Nuvio Addon
              </span>
              <span className="text-xs text-zinc-400">Mở ›</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddonSettings}
              className="w-full p-4 rounded-2xl bg-[#111625] border border-white/10 flex items-center justify-between text-left cursor-pointer"
            >
              <span className="font-bold text-sm text-white">
                ⚙️ Cài đặt API Nguồn Phim Nâng Cao
              </span>
              <span className="text-xs text-zinc-400">Mở ›</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          BOTTOM NAVIGATION BAR (STREAMLINED 4 TABS)
         ===================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-[1500] bg-[#080B14]/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around">
        {[
          { id: 'home' as MobileTab, label: 'Trang chủ', icon: '🏠' },
          { id: 'search' as MobileTab, label: 'Tìm kiếm', icon: '🔍' },
          { id: 'explore' as MobileTab, label: 'Khám phá', icon: '🎬' },
          { id: 'profile' as MobileTab, label: 'Tủ phim', icon: '👤' },
        ].map((tab) => {
          const isActive = activeTab === tab.id && !selectedItem;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedItem(null);
                setActiveTab(tab.id);
              }}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-[#E6B325]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[11px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
