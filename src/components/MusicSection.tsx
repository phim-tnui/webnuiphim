import React, { useEffect, useState, useMemo } from 'react';
import { MusicTrack, UserProfile } from '../types';

interface MusicSectionProps {
  onPlayTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  favorites: string[];
  onToggleFavorite: (trackId: string) => void;
  onShowToast: (msg: string) => void;
  currentUser?: UserProfile | null;
  onOpenAuthModal?: () => void;
}

interface MixItem {
  id: string;
  title: string;
  subtitle: string;
  trackCount: number;
  tag?: string;
  covers: string[];
  query: string;
}

interface MoodItem {
  id: string;
  name: string;
  query: string;
  bg: string;
}

interface TopArtist {
  name: string;
  initials: string;
  color: string;
  tag: string;
  hits: string;
  query: string;
}

export interface UserPlaylist {
  id: string;
  title: string;
  author: string;
  trackCount: number;
  cover: string;
  tracks: MusicTrack[];
  syncedAt?: string;
}

type TabType = 'home' | 'search' | 'playlist';

export const MusicSection: React.FC<MusicSectionProps> = ({
  onPlayTrack,
  currentTrackId,
  isPlaying,
  favorites,
  onToggleFavorite,
  onShowToast,
  currentUser,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // User Custom YouTube Playlist (PL87IX8lQCG84-eW3GjjRe_z6Q-Qjj4ULZ)
  const [customPlaylistTracks, setCustomPlaylistTracks] = useState<MusicTrack[]>([]);
  const [playlistSearchFilter, setPlaylistSearchFilter] = useState<string>('');

  // Home section data
  const [greetingCards, setGreetingCards] = useState<MusicTrack[]>([]);
  const [quickPicks, setQuickPicks] = useState<MusicTrack[]>([]);
  const [mixes, setMixes] = useState<MixItem[]>([]);
  const [moods, setMoods] = useState<MoodItem[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [showAllQuickPicks, setShowAllQuickPicks] = useState<boolean>(false);
  const [isLoadingHome, setIsLoadingHome] = useState<boolean>(true);
  const [isLiveTrending, setIsLiveTrending] = useState<boolean>(false);

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  // Fetch home sections (supports live force refresh)
  const fetchSections = (forceRefresh = false) => {
    setIsLoadingHome(true);
    const url = forceRefresh ? '/api/music/sections?refresh=1' : '/api/music/sections';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGreetingCards(data.greetingCards || []);
          setQuickPicks(data.quickPicks || []);
          setMixes(data.mixes || []);
          setMoods(data.moods || []);
          setTopArtists(data.topArtists || []);
          setIsLiveTrending(Boolean(data.isLive));
        }
      })
      .catch((err) => {
        console.warn('[Music] Error loading sections:', err);
      })
      .finally(() => {
        setIsLoadingHome(false);
      });
  };

  useEffect(() => {
    fetchSections(false);

    // Fetch user public YouTube playlist (75 tracks)
    fetch('/api/music/custom-playlist')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setCustomPlaylistTracks(data.tracks);
        } else {
          throw new Error('API empty');
        }
      })
      .catch(() => {
        // Fallback to static public json file
        fetch('/user_playlist_PL87IX8lQCG84.json')
          .then((r) => r.json())
          .then((tracks) => {
            if (Array.isArray(tracks)) {
              setCustomPlaylistTracks(tracks);
            }
          })
          .catch(() => {});
      });
  }, []);

  // Sync favorites with Google Account whenever favorites change
  useEffect(() => {
    if (currentUser?.id) {
      fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          favorites,
        }),
      }).catch(() => {});
    }
  }, [favorites, currentUser?.id]);

  // Direct Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.results) {
            setSearchResults(data.results);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Play All
  const handlePlayAll = () => {
    if (quickPicks.length > 0) {
      onPlayTrack(quickPicks[0], quickPicks);
      onShowToast(`🎶 Bắt đầu phát: ${quickPicks[0].title}`);
    }
  };

  // Play a mood or artist by searching first
  const handlePlayQuery = async (query: string, label: string) => {
    onShowToast(`🔍 Đang tải bài hát: ${label}...`);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        onPlayTrack(data.results[0], data.results);
        onShowToast(`▶ Đang phát: ${data.results[0].title}`);
      } else {
        onShowToast(`Không tìm thấy bài hát phù hợp cho ${label}`);
      }
    } catch (_) {
      onShowToast(`Lỗi kết nối khi tải ${label}`);
    }
  };

  return (
    <div className="space-y-7 animate-fade-in pb-32 max-w-[1340px] mx-auto">
      {/* =====================================================================
          1. HEADER: BRAND TITLE + LIVE BADGE
         ===================================================================== */}
      <div className="flex items-center gap-3 pt-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Âm nhạc
        </h1>

        {/* Real-Time Live YouTube Music Sync Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>YouTube Music Live</span>
        </div>
      </div>

      {/* =====================================================================
          2. PILL NAVIGATION TABS: 🏠 Trang chủ | 🔍 Tìm kiếm | ▶️ Danh sách phát
         ===================================================================== */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'home'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25 scale-[1.02]'
              : 'bg-[#141824] hover:bg-[#1a2133] text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          <span>🏠</span>
          <span>Trang chủ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'search'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25 scale-[1.02]'
              : 'bg-[#141824] hover:bg-[#1a2133] text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          <span>🔍</span>
          <span>Tìm kiếm</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('playlist')}
          className={`px-5 py-2 rounded-full text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'playlist'
              ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/25 scale-[1.02]'
              : 'bg-[#141824] hover:bg-[#1a2133] text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          <span>▶️</span>
          <span>Danh sách phát</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'playlist' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {customPlaylistTracks.length || 75}
          </span>
        </button>
      </div>

      {/* =====================================================================
          VIEW: SEARCH TAB (WITH QUICK ACCESS TO PLAYLIST NEAR SEARCH BOX)
         ===================================================================== */}
      {activeTab === 'search' && (
        <div className="space-y-5 animate-fade-in">
          {/* Search Input Box */}
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="🔍 Tìm kiếm bài hát, ca sĩ, album hoặc dán link YouTube..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-5 py-3.5 pl-11 rounded-2xl bg-[#141824] border border-amber-500/40 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 shadow-xl"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
              🎵
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* QUICK PLAYLIST CARD RIGHT NEAR THE SEARCH BOX */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#131a2b] to-[#151c2e] border border-amber-500/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-400 text-black flex items-center justify-center text-lg font-black shrink-0 shadow-md">
                ▶
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                    Danh Sách Phát Của Bạn (Nghe nhạc)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Công Khai • {customPlaylistTracks.length || 75} bài
                  </span>
                </div>
                <p className="text-xs text-white/90 truncate mt-0.5 font-medium">
                  Sóc Trăng Drill, Nếu Còn Có Kiếp Sau, Nắng Dưới Chân Mây, Phai Dấu Cuộc Tình...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (customPlaylistTracks.length > 0) {
                    onPlayTrack(customPlaylistTracks[0], customPlaylistTracks);
                    onShowToast(`▶ Đang phát bài 1: ${customPlaylistTracks[0].title}`);
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-400/20 transition-all active:scale-95"
              >
                <span>▶ Phát Toàn Bộ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('playlist')}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer border border-white/10 text-center"
              >
                Xem {customPlaylistTracks.length || 75} bài ➔
              </button>
            </div>
          </div>

          {/* Search Result or Playlist Songs List */}
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-xs font-semibold">Đang tìm bài hát trực tiếp trên YouTube Music...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map((track, idx) => {
                const isCurrent = currentTrackId === track.id;
                const isFav = favorites.includes(track.id);
                return (
                  <div
                    key={`search_${track.id}_${idx}`}
                    onClick={() => onPlayTrack(track, searchResults)}
                    className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-amber-400/15 border-amber-400/60 shadow-lg'
                        : 'bg-[#121623] hover:bg-[#181d2e] border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div
                          className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <span className="text-amber-400 text-sm font-bold">
                            {isCurrent && isPlaying ? '⏸' : '▶'}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4
                          className={`text-xs font-bold truncate transition-colors ${
                            isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                          }`}
                        >
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {track.duration}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.id);
                        }}
                        className={`p-1.5 rounded-full transition-all cursor-pointer ${
                          isFav ? 'text-rose-500 bg-rose-500/10' : 'text-zinc-500 hover:text-rose-400'
                        }`}
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* When not actively searching, show all songs from the user's playlist right below */
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">
                    🎶 Toàn Bộ Bài Hát Trong Danh Sách Phát ({customPlaylistTracks.length || 75})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (customPlaylistTracks.length > 0) {
                      onPlayTrack(customPlaylistTracks[0], customPlaylistTracks);
                      onShowToast(`▶ Bắt đầu phát: "${customPlaylistTracks[0].title}"`);
                    }
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                >
                  ▶ Phát tất cả
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {customPlaylistTracks.map((track, idx) => {
                  const isCurrent = currentTrackId === track.id;
                  const isFav = favorites.includes(track.id);
                  return (
                    <div
                      key={`pl_quick_${track.id}_${idx}`}
                      onClick={() => onPlayTrack(track, customPlaylistTracks)}
                      className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-amber-400/15 border-amber-400/60 shadow-lg'
                          : 'bg-[#121623] hover:bg-[#181d2e] border-white/10 hover:border-amber-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-mono text-zinc-500 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <img
                            src={track.cover}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          <div
                            className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                              isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <span className="text-amber-400 text-sm font-bold">
                              {isCurrent && isPlaying ? '⏸' : '▶'}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <h4
                            className={`text-xs font-bold truncate transition-colors ${
                              isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                            }`}
                          >
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-500">
                          {track.duration}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(track.id);
                          }}
                          className={`p-1.5 rounded-full transition-all cursor-pointer ${
                            isFav ? 'text-rose-500 bg-rose-500/10' : 'text-zinc-500 hover:text-rose-400'
                          }`}
                        >
                          ♥
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VIEW: DEDICATED PLAYLIST TAB (NGHE NHẠC - 75 BÀI HÁT YOUTUBE)
         ===================================================================== */}
      {activeTab === 'playlist' && (
        <div className="space-y-6 animate-fade-in">
          {/* Playlist Banner Header */}
          <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-[#172036] via-[#111728] to-[#1a152e] border border-amber-500/40 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-white/20 shadow-xl bg-zinc-900">
                <img
                  src={
                    customPlaylistTracks[0]?.cover ||
                    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'
                  }
                  alt="Playlist Cover"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-amber-300 font-bold">
                  {customPlaylistTracks.length || 75} bài
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider">
                    YouTube Playlist
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Công Khai
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight truncate">
                  Nghe nhạc
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Danh sách phát YouTube cá nhân • {customPlaylistTracks.length || 75} bài hát tuyển chọn
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (customPlaylistTracks.length > 0) {
                    onPlayTrack(customPlaylistTracks[0], customPlaylistTracks);
                    onShowToast(`▶ Bắt đầu phát: "${customPlaylistTracks[0].title}"`);
                  }
                }}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-400/25 cursor-pointer active:scale-95 transition-all"
              >
                <span>▶</span>
                <span>Phát Toàn Bộ ({customPlaylistTracks.length || 75})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (customPlaylistTracks.length > 0) {
                    const shuffled = [...customPlaylistTracks].sort(() => Math.random() - 0.5);
                    onPlayTrack(shuffled[0], shuffled);
                    onShowToast(`🔀 Đang trộn bài & phát: "${shuffled[0].title}"`);
                  }
                }}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 transition-all"
              >
                <span>🔀</span>
                <span>Trộn bài</span>
              </button>
            </div>
          </div>

          {/* Quick Filter inside Playlist */}
          <div className="relative">
            <input
              type="text"
              placeholder={`Lọc nhanh trong ${customPlaylistTracks.length || 75} bài hát (tên bài, ca sĩ)...`}
              value={playlistSearchFilter}
              onChange={(e) => setPlaylistSearchFilter(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 rounded-xl bg-[#141824] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-amber-400"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
              🔍
            </span>
            {playlistSearchFilter && (
              <button
                type="button"
                onClick={() => setPlaylistSearchFilter('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Playlist Tracks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customPlaylistTracks
              .filter((track) => {
                if (!playlistSearchFilter.trim()) return true;
                const q = playlistSearchFilter.toLowerCase();
                return (
                  track.title.toLowerCase().includes(q) ||
                  track.artist.toLowerCase().includes(q)
                );
              })
              .map((track, idx) => {
                const isCurrent = currentTrackId === track.id;
                const isFav = favorites.includes(track.id);
                return (
                  <div
                    key={`pl_main_${track.id}_${idx}`}
                    onClick={() => onPlayTrack(track, customPlaylistTracks)}
                    className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-amber-400/15 border-amber-400/60 shadow-lg'
                        : 'bg-[#121623] hover:bg-[#181d2e] border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs font-mono text-zinc-500 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div
                          className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <span className="text-amber-400 text-sm font-bold">
                            {isCurrent && isPlaying ? '⏸' : '▶'}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4
                          className={`text-xs font-bold truncate transition-colors ${
                            isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                          }`}
                        >
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {track.duration}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.id);
                        }}
                        className={`p-1.5 rounded-full transition-all cursor-pointer ${
                          isFav ? 'text-rose-500 bg-rose-500/10' : 'text-zinc-500 hover:text-rose-400'
                        }`}
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW: HOME TAB (REAL-TIME YOUTUBE MUSIC TRENDING & SLEEK ARTISTS)
         ===================================================================== */}
      {activeTab === 'home' && (
        <div className="space-y-8 animate-fade-in">
          {/* =================================================================
              3. GREETING SECTION ("Chào buổi sáng / chiều / tối")
             ================================================================= */}
          <div className="space-y-3.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {greeting}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Card 1: Bài hát đã thích (Signature Amber Tile) */}
              <div
                onClick={() => {
                  const favTracks = quickPicks.filter((t) => favorites.includes(t.id));
                  if (favTracks.length > 0) {
                    onPlayTrack(favTracks[0], favTracks);
                    onShowToast(`▶ Đang phát ${favTracks.length} bài hát đã thích`);
                  } else if (greetingCards.length > 0) {
                    onPlayTrack(greetingCards[0], greetingCards);
                    onShowToast('▶ Bắt đầu phát nhạc');
                  } else {
                    onShowToast('Chưa có bài hát đã thích. Bấm ♥ ở bất kỳ bài hát nào để lưu!');
                  }
                }}
                className="group p-2.5 rounded-2xl bg-[#131724] hover:bg-[#191f32] border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer flex items-center gap-3.5 shadow-md"
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-white text-2xl shadow-lg shrink-0">
                  <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                    Bài hát đã thích
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {favorites.length > 0 ? `${favorites.length} bài hát • Bấm để phát` : 'Bấm ♥ để thêm bài hát'}
                  </p>
                </div>
              </div>

              {/* Card 2: Danh sách phát YouTube (Nghe nhạc - 75 bài) */}
              <div
                onClick={() => {
                  if (customPlaylistTracks.length > 0) {
                    onPlayTrack(customPlaylistTracks[0], customPlaylistTracks);
                    onShowToast(`▶ Đang phát danh sách: "${customPlaylistTracks[0].title}"`);
                  }
                }}
                className="group p-2.5 rounded-2xl bg-[#131724] hover:bg-[#191f32] border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer flex items-center justify-between gap-3.5 shadow-md"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-900 relative">
                    <img
                      src={customPlaylistTracks[0]?.cover || 'https://i.ytimg.com/vi/yGKEon_Zw2M/hqdefault.jpg'}
                      alt="Playlist"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-amber-400 text-sm font-bold">▶</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                      Danh sách phát: Nghe nhạc
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {customPlaylistTracks.length || 75} bài • Bấm để nghe ngay
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('playlist');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                >
                  Xem ➔
                </button>
              </div>

              {/* Cards 3, 4: Quick play cards from curated / live list */}
              {greetingCards.map((track, idx) => {
                const isCurrent = currentTrackId === track.id;
                return (
                  <div
                    key={`greeting_${track.id}_${idx}`}
                    onClick={() => onPlayTrack(track, quickPicks)}
                    className={`group p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md ${
                      isCurrent
                        ? 'bg-amber-400/15 border-amber-400/60 ring-1 ring-amber-400/30'
                        : 'bg-[#131724] hover:bg-[#191f32] border-white/10 hover:border-amber-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <span className="text-amber-400 text-sm font-bold">
                            {isCurrent && isPlaying ? '⏸' : '▶'}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3
                          className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                            isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                          }`}
                        >
                          {track.title}
                        </h3>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center text-xs font-black shadow-md">
                        ▶
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =================================================================
              4. GỢI Ý BÀI HÁT (QUICK PICKS WITH AMBER PLAY CIRCLE)
             ================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Gợi ý bài hát
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Những bài hát thịnh hành trên YouTube Music hôm nay
                </p>
              </div>

              <button
                type="button"
                onClick={handlePlayAll}
                className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/25 transition-all cursor-pointer active:scale-95"
              >
                <span>▶</span>
                <span>Nghe tất cả</span>
              </button>
            </div>

            {/* Quick picks grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {(showAllQuickPicks ? quickPicks : quickPicks.slice(0, 6)).map((track, idx) => {
                const isCurrent = currentTrackId === track.id;
                const isFav = favorites.includes(track.id);

                return (
                  <div
                    key={`quick_${track.id}_${idx}`}
                    onClick={() => onPlayTrack(track, quickPicks)}
                    className="group flex flex-col cursor-pointer"
                  >
                    {/* Artwork Container */}
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 group-hover:border-amber-400/50 transition-all shadow-md bg-zinc-900">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Top-Right Favorite button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.id);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full transition-all cursor-pointer z-10 ${
                          isFav
                            ? 'text-rose-500 bg-black/60'
                            : 'text-white/70 hover:text-white bg-black/40 hover:bg-black/60'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>

                      {/* Signature Amber Play Button */}
                      <div className="absolute bottom-2.5 right-2.5 z-10">
                        <div
                          className={`w-10 h-10 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-sm shadow-xl shadow-amber-400/30 transition-all ${
                            isCurrent
                              ? 'scale-105 ring-2 ring-white'
                              : 'opacity-90 group-hover:opacity-100 group-hover:scale-110'
                          }`}
                        >
                          {isCurrent && isPlaying ? '⏸' : '▶'}
                        </div>
                      </div>

                      {/* Active indicator overlay */}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-amber-500/20 border-2 border-amber-400 pointer-events-none rounded-2xl" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="pt-2.5 px-0.5">
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                          isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                        }`}
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* "Xem thêm gợi ý ›" toggle */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowAllQuickPicks(!showAllQuickPicks)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{showAllQuickPicks ? 'Thu gọn gợi ý' : 'Xem thêm gợi ý'}</span>
                <span>›</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              5. MIX DÀNH CHO BẠN (COLLAGE 2x2 ARTWORK & LIVE MIX BADGE)
             ================================================================= */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Mix dành cho bạn
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Làm mới mỗi ngày theo bảng xếp hạng âm nhạc YouTube
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {mixes.map((mix) => (
                <div
                  key={mix.id}
                  onClick={() => handlePlayQuery(mix.query, mix.title)}
                  className="group flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 group-hover:border-amber-400/50 shadow-md bg-[#101420]">
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                      {mix.covers.map((cov, i) => (
                        <img
                          key={i}
                          src={cov}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ))}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider shadow">
                        {mix.tag || 'MIX'}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
                      <h3 className="text-base sm:text-lg font-black text-white drop-shadow-md leading-tight">
                        {mix.title}
                      </h3>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                      <div className="w-12 h-12 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-base shadow-xl transform group-hover:scale-110 transition-transform">
                        ▶
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 px-0.5">
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {mix.subtitle} • {mix.trackCount} bài
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* =================================================================
              6. TÂM TRẠNG VÀ THỂ LOẠI (CHỌN CHỦ ĐỀ CÓ NGAY DANH SÁCH)
             ================================================================= */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Tâm trạng và thể loại
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Chọn một chủ đề, có ngay danh sách để nghe
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {moods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handlePlayQuery(m.query, m.name)}
                  className={`p-4 rounded-2xl border text-left font-black text-sm sm:text-base transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-98 flex items-center justify-between ${m.bg}`}
                >
                  <span>{m.name}</span>
                  <span className="text-xs opacity-60">▶</span>
                </button>
              ))}
            </div>
          </div>

          {/* =================================================================
              7. NGHỆ SĨ HÀNG ĐẦU VIỆT NAM (REFINED SLEEK TYPOGRAPHY CARDS - NO STOCK PHOTOS)
             ================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Nghệ sĩ hàng đầu Việt Nam
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Chọn tên nghệ sĩ để nghe trực tiếp các ca khúc hot nhất trên YouTube Music
                </p>
              </div>

              <span className="text-[11px] font-bold text-amber-400/90 hidden sm:inline">
                Chạm để nghe bản hit
              </span>
            </div>

            {/* Sleek typography artist cards: Monogram badges with verified seal */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
              {topArtists.map((artist, idx) => (
                <div
                  key={`artist_${idx}`}
                  onClick={() => handlePlayQuery(artist.query, artist.name)}
                  className="group relative p-3.5 rounded-2xl bg-[#121624] hover:bg-[#1a2136] border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer shadow-lg flex flex-col justify-between gap-3 overflow-hidden"
                >
                  {/* Background ambient glow on hover */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:from-amber-500/25 transition-all" />

                  <div className="flex items-center justify-between z-10">
                    {/* Monogram Badge */}
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${artist.color} flex items-center justify-center text-white text-xs font-black shadow-md shrink-0`}
                    >
                      {artist.initials}
                    </div>

                    {/* Quick play action */}
                    <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-amber-400 group-hover:text-black text-zinc-400 flex items-center justify-center text-xs font-black transition-all shadow">
                      ▶
                    </div>
                  </div>

                  {/* Artist Details */}
                  <div className="z-10 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                        {artist.name}
                      </h4>
                      <span className="text-amber-400 text-xs shrink-0" title="Nghệ sĩ xác minh">
                        ✓
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-zinc-400 font-medium truncate">
                        {artist.tag}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-500 truncate mt-1">
                      {artist.hits}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

