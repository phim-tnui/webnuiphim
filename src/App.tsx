import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ADULT_CATALOGS,
  DEFAULT_MOVIE_CATALOGS,
  DEFAULT_TV_CATALOGS,
} from './data/catalogs';
import { fromBase64Url, parseMultipleUrls, toBase64Url } from './utils/streamUtils';
import {
  clearStoredPreviewJwt,
  CLOUD_BACKEND_ORIGIN,
  downloadVerifiedBinaryAsset,
  getStoredPreviewJwt,
  installPreviewAuthInterceptors,
  isNativeCapacitorApp,
  isStaticGitHubPagesHost,
  previewFetch,
  setPreviewUnauthorizedHandler,
} from './utils/previewAuth';
import { PlayerModal } from './components/PlayerModal';
import {
  AdminAuthGateModal,
  PreviewPasswordModal,
  QrModal,
  Unlock18Modal,
} from './components/Modals';
import { AdvancedSettingsModal } from './components/AdvancedSettingsModal';
import { PreviewErrorBoundary } from './components/PreviewErrorBoundary';
import { PreviewWebApp } from './components/PreviewWebApp';

import { ClassicAddonModal } from './components/ClassicAddonModal';
import { AndroidTvApp } from './components/AndroidTvApp';
import { MobileCinemaApp } from './components/MobileCinemaApp';
import { AppUpdateChecker } from './components/AppUpdateChecker';
import { LandingSecurityGate } from './components/LandingSecurityGate';
import { RoPhimAuthModal } from './components/RoPhimAuthModal';
import { appendPreviewJwtToUrl } from './utils/previewAuth';
import { CatalogItem, CustomEndpoints, MusicTrack, PreviewTarget, StreamMode, UserProfile } from './types';

// Install global fetch, XMLHttpRequest, and EventSource JWT interceptors immediately
installPreviewAuthInterceptors();

// ============================================================================
// HIDDEN BACKGROUND AUTOMATION CONSTANTS
// Live TV, Live Football, Live Network Scraper, Captured Streams,
// Stream Proxy & ClearKey Decryption, and Auraflix 30m run automatically.
// ============================================================================
const HIDDEN_BACKGROUND_AUTOMATION = Object.freeze({
  DEFAULT_STREAM_MODE: 'native' as StreamMode,
  STREAM_PROXY_ENABLED: true,
  CLEARKEY_DECRYPTION_ENABLED: true,
  LIVE_TV_SYNC_INTERVAL_MS: 10 * 60 * 1000, // 10m automated .mpd health & channel sync
  LIVE_FOOTBALL_SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5m automated live football sync
  AURAFLIX_CRAWLER_INTERVAL_MS: 30 * 60 * 1000, // 30m automated Auraflix & ClearKey crawl
  CAPTURED_STREAMS_SYNC_INTERVAL_MS: 15 * 60 * 1000, // 15m captured stream pool refresh
  ALLOWED_TV_CATALOG_IDS: [
    'tv_tong_hop',
    'tv_quoc_te',
    'tv_vtv',
    'tv_vtvcab',
    'tv_giai_tri',
    'tv_dia_phuong',
    'sports_live_matches',
  ] as const,
});

export const App: React.FC = () => {
  const [previewJwtToken, setPreviewJwtToken] = useState<string | null>(
    () => getStoredPreviewJwt() || 'auto_authorized'
  );

  // Temporarily bypass password lock screen on Web so user can inspect and improve all 3 modes directly
  const [isPreviewAuthOpen, setIsPreviewAuthOpen] = useState<boolean>(false);
  const [showLandingGate, setShowLandingGate] = useState<boolean>(false);
  const [isClassicAddonModalOpen, setIsClassicAddonModalOpen] = useState<boolean>(false);
  const [isUpdateCheckerOpen, setIsUpdateCheckerOpen] = useState<boolean>(false);

  // User Auth & Profile State (RoPhim Style Modal)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem('phimtnui_current_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Music State (CatMeowTeam/MeowHearing inspired)
  const [currentMusicTrack, setCurrentMusicTrack] = useState<MusicTrack | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicFavorites, setMusicFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('phimtnui_music_favorites');
      return raw ? JSON.parse(raw) : ['dQw4w9WgXcQ', '2Vv-BfVoq4g', 'CevxZvSJLk8'];
    } catch {
      return ['dQw4w9WgXcQ', '2Vv-BfVoq4g', 'CevxZvSJLk8'];
    }
  });

  const handleUserLogin = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('phimtnui_current_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    // Auto-restore Google cloud playlist favorites
    if (user?.id) {
      fetch(`/api/user/library/${user.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.library && Array.isArray(d.library.favorites) && d.library.favorites.length > 0) {
            setMusicFavorites(d.library.favorites);
            try {
              localStorage.setItem('phimtnui_music_favorites', JSON.stringify(d.library.favorites));
            } catch (_) {}
          }
        })
        .catch(() => {});
    }
  }, []);

  // Sync Google cloud library on initial mount if already logged in
  useEffect(() => {
    if (currentUser?.id) {
      fetch(`/api/user/library/${currentUser.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.library && Array.isArray(d.library.favorites) && d.library.favorites.length > 0) {
            setMusicFavorites(d.library.favorites);
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id]);

  const handleUserLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('phimtnui_current_user');
    } catch {
      // ignore
    }
  }, []);

  const musicQueueRef = useRef<MusicTrack[]>([]);
  const musicIndexRef = useRef<number>(-1);
  const [, setMusicQueue] = useState<MusicTrack[]>([]);

  const handlePlayMusicTrack = useCallback((track: MusicTrack, queue?: MusicTrack[]) => {
    if (queue && queue.length > 0) {
      musicQueueRef.current = queue;
      setMusicQueue(queue);
      const idx = queue.findIndex((t) => t.id === track.id);
      musicIndexRef.current = idx !== -1 ? idx : 0;
    } else {
      const existing = musicQueueRef.current;
      const idx = existing.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        musicIndexRef.current = idx;
      } else {
        const nextQueue = [...existing, track];
        musicQueueRef.current = nextQueue;
        setMusicQueue(nextQueue);
        musicIndexRef.current = nextQueue.length - 1;
      }
    }
    setCurrentMusicTrack(track);
    setIsMusicPlaying(true);
  }, []);

  const handleToggleMusicPlay = useCallback(() => {
    setIsMusicPlaying((prev) => !prev);
  }, []);

  const handleNextMusicTrack = useCallback(() => {
    const queue = musicQueueRef.current;
    if (queue.length === 0) return;
    const nextIdx = (musicIndexRef.current + 1) % queue.length;
    musicIndexRef.current = nextIdx;
    const nextTrack = queue[nextIdx];
    if (nextTrack) {
      setCurrentMusicTrack(nextTrack);
      setIsMusicPlaying(true);
    }
  }, []);

  const handlePrevMusicTrack = useCallback(() => {
    const queue = musicQueueRef.current;
    if (queue.length === 0) return;
    const prevIdx = musicIndexRef.current <= 0 ? queue.length - 1 : musicIndexRef.current - 1;
    musicIndexRef.current = prevIdx;
    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      setCurrentMusicTrack(prevTrack);
      setIsMusicPlaying(true);
    }
  }, []);

  const handleToggleMusicFavorite = useCallback((trackId: string) => {
    setMusicFavorites((prev) => {
      const next = prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId];
      try {
        localStorage.setItem('phimtnui_music_favorites', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleCloseMusicPlayer = useCallback(() => {
    setIsMusicPlaying(false);
    setCurrentMusicTrack(null);
  }, []);

  // UI Mode: 'web' | 'mobitv' | 'tv'
  // - Native Mobile APK (__PHIMTNUI_APP_FLAVOR__ === 'mobitv') -> strictly 'mobitv' (MobileCinemaApp)
  // - Native Android TV APK (__PHIMTNUI_APP_FLAVOR__ === 'androidtv') -> strictly 'tv' (AndroidTvApp)
  // - Web browser -> defaults to 'web' (PreviewWebApp)
  const [uiMode, setUiMode] = useState<'web' | 'mobitv' | 'tv'>(() => {
    try {
      const appFlavor = String((window as any).__PHIMTNUI_APP_FLAVOR__ || '').toLowerCase();
      if (appFlavor === 'androidtv') return 'tv';
      if (appFlavor === 'mobitv') return 'mobitv';

      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      if (modeParam === 'tv') return 'tv';
      if (modeParam === 'mobitv' || modeParam === 'mobile') return 'mobitv';
      if (modeParam === 'web') return 'web';

      // Smart TV / Android TV hardware auto-detection (Xiaomi TV, Google TV, Mi Box, Sony BRAVIA)
      const ua = (navigator.userAgent || '').toLowerCase();
      const isTv =
        ua.includes('smart-tv') ||
        ua.includes('smarttv') ||
        ua.includes('googletv') ||
        ua.includes('android tv') ||
        ua.includes('mitv') ||
        ua.includes('aft') ||
        ua.includes('bravia') ||
        ua.includes('leanback');
      if (isTv) return 'tv';

      return 'web';
    } catch {
      return 'web';
    }
  });

  const handleSwitchUiMode = useCallback((mode: 'web' | 'mobitv' | 'tv') => {
    const appFlavor = String((window as any).__PHIMTNUI_APP_FLAVOR__ || '').toLowerCase();
    if (appFlavor === 'androidtv') {
      setUiMode('tv');
      return;
    }
    if (appFlavor === 'mobitv') {
      setUiMode('mobitv');
      return;
    }
    setUiMode(mode);
    showToastMessage(
      mode === 'tv'
        ? '📺 Đã chuyển sang Giao diện Android TV (Smart TV D-Pad)'
        : mode === 'mobitv'
        ? '📱 Đã chuyển sang Giao diện App MobiTV'
        : '🌐 Đã chuyển về Giao diện Web Đầy Đủ'
    );
  }, []);

  // Catalogs state (Live TV strictly maintains the 4 selection filters)
  const [tvCatalogs, setTvCatalogs] = useState<CatalogItem[]>(DEFAULT_TV_CATALOGS);
  const [movieCatalogs, setMovieCatalogs] = useState<CatalogItem[]>(DEFAULT_MOVIE_CATALOGS);
  const [adultCatalogs, setAdultCatalogs] = useState<CatalogItem[]>(DEFAULT_ADULT_CATALOGS);

  // User config state
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(() => {
    return [
      ...DEFAULT_TV_CATALOGS.filter((c) => c.defaultChecked).map((c) => c.id),
      ...DEFAULT_MOVIE_CATALOGS.filter((c) => c.defaultChecked).map((c) => c.id),
    ];
  });
  const [debridKey, setDebridKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [customMovieApi, setCustomMovieApi] = useState('');
  const [customEndpoints, setCustomEndpoints] = useState<CustomEndpoints>({});
  const [isSavingMovieApi, setIsSavingMovieApi] = useState(false);
  const [movieApiSavedBadge, setMovieApiSavedBadge] = useState(false);

  // 18+ unlock state
  const [is18Unlocked, setIs18Unlocked] = useState(false);
  const [adultExpanded, setAdultExpanded] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isUnlock18ModalOpen, setIsUnlock18ModalOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

  // Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMessage = useCallback((msg: string) => {
    setToastMsg(msg || '✅ Hoàn tất!');
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  }, []);

  // Disable 401 kickout while password screen is bypassed
  useEffect(() => {
    setPreviewUnauthorizedHandler(null);
    return () => setPreviewUnauthorizedHandler(null);
  }, []);

  // Ensure token is always active
  useEffect(() => {
    const existingToken = getStoredPreviewJwt() || 'auto_authorized';
    setPreviewJwtToken(existingToken);
  }, []);

  // Always keep body tagged for preview styling
  useEffect(() => {
    document.body.classList.add('preview-web-active');
    return () => {
      document.body.classList.remove('preview-web-active');
    };
  }, []);

  const handlePreviewAuthenticated = useCallback(
    (token: string) => {
      setPreviewJwtToken(token);
      setIsPreviewAuthOpen(false);
      showToastMessage('🔓 Xác thực JWT thành công (hiệu lực 2 giờ) — Chào mừng bạn đến với PHIM.TNUI!');
    },
    [showToastMessage]
  );

  // Automated background synchronization workers (runs when authenticated with valid JWT)
  const runAutomatedBackgroundSync = useCallback(async () => {
    if (!getStoredPreviewJwt()) return;
    try {
      await Promise.allSettled([
        previewFetch('/api/bot/status'),
        previewFetch('/api/live-tv/channels?status=all&category=all'),
        previewFetch('/api/football/matches'),
        previewFetch('/api/scraped-streams'),
        previewFetch('/api/scraper/crawler-status'),
      ]);
    } catch {
      // silent background automation
    }
  }, []);

  // Restore configuration from URL / localStorage and initialize automated background processes
  useEffect(() => {
    if (previewJwtToken) {
      previewFetch('/api/catalogs')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.success) {
            if (Array.isArray(d.tvCatalogs) && d.tvCatalogs.length > 0) {
              const allowedSet = new Set<string>(
                HIDDEN_BACKGROUND_AUTOMATION.ALLOWED_TV_CATALOG_IDS
              );
              const prunedTv = d.tvCatalogs.filter((c: CatalogItem) => allowedSet.has(c.id));
              if (prunedTv.length > 0) setTvCatalogs(prunedTv);
            }
            if (Array.isArray(d.movieCatalogs) && d.movieCatalogs.length > 0)
              setMovieCatalogs(d.movieCatalogs);
            if (Array.isArray(d.adultCatalogs) && d.adultCatalogs.length > 0)
              setAdultCatalogs(d.adultCatalogs);
          }
        })
        .catch(() => {});
    }

    try {
      let urlCfg = '';
      const path = window.location.pathname || '';
      if (path.includes('configure')) {
        const parts = path.split('/');
        for (let pi = 0; pi < parts.length; pi++) {
          if (parts[pi] === 'configure' && pi > 0) {
            const cand = parts[pi - 1];
            if (cand && cand !== 'config') {
              urlCfg = cand;
              break;
            }
          }
        }
      }

      let parsedUrlConfig: {
        rd?: string;
        ai?: string;
        c?: string[];
        catalogs?: string[];
      } | null = null;

      if (urlCfg) {
        try {
          parsedUrlConfig = JSON.parse(fromBase64Url(urlCfg));
        } catch {
          parsedUrlConfig = null;
        }
      }

      if (parsedUrlConfig) {
        if (parsedUrlConfig.rd) setDebridKey(parsedUrlConfig.rd);
        if (parsedUrlConfig.ai) setGeminiKey(parsedUrlConfig.ai);
        const cats = parsedUrlConfig.c || parsedUrlConfig.catalogs;
        if (Array.isArray(cats)) {
          setSelectedCatalogs(cats);
        }
      } else {
        const savedDebrid = localStorage.getItem('tungnui_debrid_key');
        if (savedDebrid) setDebridKey(savedDebrid);

        const savedGemini = localStorage.getItem('tungnui_gemini_key');
        if (savedGemini) setGeminiKey(savedGemini);

        const savedMovieApi = localStorage.getItem('tungnui_custom_movie_api');
        if (savedMovieApi) setCustomMovieApi(savedMovieApi);

        if (previewJwtToken) {
          previewFetch('/api/settings/movie-source')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.endpoints) {
                setCustomEndpoints(d.endpoints);
                const apis =
                  d.endpoints.customMovieApis ||
                  (d.endpoints.customMovieApi ? [d.endpoints.customMovieApi] : []);
                if (apis.length > 0 && !savedMovieApi) {
                  setCustomMovieApi(apis.join(', '));
                }
              }
            })
            .catch(() => {});
        }

        const savedConfigsRaw = localStorage.getItem('tungnui_selected_cats');
        if (savedConfigsRaw) {
          const savedConfigs = JSON.parse(savedConfigsRaw);
          if (Array.isArray(savedConfigs)) {
            setSelectedCatalogs(savedConfigs);
          }
        }
      }

      const saved18 = localStorage.getItem('nuvio_18_unlocked') === 'true';
      if (saved18) {
        setIs18Unlocked(true);
      }

      if (
        window.location.pathname.includes('configure') ||
        window.location.hash.includes('settings')
      ) {
        setTimeout(() => {
          const isAuth =
            sessionStorage.getItem('nuvio_admin_auth') === 'true' ||
            localStorage.getItem('nuvio_admin_auth') === 'true';
          if (isAuth) setIsSettingsOpen(true);
          else setIsAdminAuthOpen(true);
        }, 120);
      }
    } catch {
      // ignore storage errors
    }

    if (!previewJwtToken) return;

    // Start automated background processes immediately and on hidden schedules
    runAutomatedBackgroundSync();

    const liveTvTimer = setInterval(() => {
      if (getStoredPreviewJwt()) {
        previewFetch('/api/live-tv/channels?status=all&category=all').catch(() => {});
      }
    }, HIDDEN_BACKGROUND_AUTOMATION.LIVE_TV_SYNC_INTERVAL_MS);

    const footballTimer = setInterval(() => {
      if (getStoredPreviewJwt()) {
        previewFetch('/api/football/matches').catch(() => {});
      }
    }, HIDDEN_BACKGROUND_AUTOMATION.LIVE_FOOTBALL_SYNC_INTERVAL_MS);

    const capturedStreamsTimer = setInterval(() => {
      if (getStoredPreviewJwt()) {
        previewFetch('/api/scraped-streams').catch(() => {});
      }
    }, HIDDEN_BACKGROUND_AUTOMATION.CAPTURED_STREAMS_SYNC_INTERVAL_MS);

    const auraflixTimer = setInterval(() => {
      if (getStoredPreviewJwt()) {
        previewFetch('/api/scraper/crawler-status').catch(() => {});
        previewFetch('/api/bot/status').catch(() => {});
      }
    }, HIDDEN_BACKGROUND_AUTOMATION.AURAFLIX_CRAWLER_INTERVAL_MS);

    return () => {
      clearInterval(liveTvTimer);
      clearInterval(footballTimer);
      clearInterval(capturedStreamsTimer);
      clearInterval(auraflixTimer);
    };
  }, [runAutomatedBackgroundSync, previewJwtToken]);

  // Persist user configuration changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tungnui_selected_cats', JSON.stringify(selectedCatalogs));
      localStorage.setItem('tungnui_debrid_key', debridKey.trim());
      localStorage.setItem('tungnui_gemini_key', geminiKey.trim());
      localStorage.setItem('tungnui_stream_mode', HIDDEN_BACKGROUND_AUTOMATION.DEFAULT_STREAM_MODE);
    } catch {
      // ignore storage errors
    }
  }, [selectedCatalogs, debridKey, geminiKey]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsAdminAuthOpen(false);
        setIsPreviewAuthOpen(false);
        setIsUnlock18ModalOpen(false);
        setIsQrModalOpen(false);
        setPreviewTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Build manifest URL path using hardcoded background stream mode + embedded JWT token
  const getUrlPath = useCallback(() => {
    const configObj: {
      c: string[];
      m: StreamMode;
      rd?: string;
      ai?: string;
      jwt?: string;
    } = {
      c: selectedCatalogs,
      m: HIDDEN_BACKGROUND_AUTOMATION.DEFAULT_STREAM_MODE,
    };
    if (debridKey.trim()) configObj.rd = debridKey.trim();
    if (geminiKey.trim()) configObj.ai = geminiKey.trim();
    const activeToken = previewJwtToken || getStoredPreviewJwt();
    if (activeToken) configObj.jwt = activeToken;

    const jsonStr = JSON.stringify(configObj);
    const b64 = toBase64Url(jsonStr);
    return `/config/${b64}/manifest.json`;
  }, [selectedCatalogs, debridKey, geminiKey, previewJwtToken]);

  const addonOrigin = isStaticGitHubPagesHost()
    ? CLOUD_BACKEND_ORIGIN
    : window.location.origin;
  const addonHost = addonOrigin.replace(/^https?:\/\//i, '');
  const stremioInstallHref = `stremio://${addonHost}${getUrlPath()}`;
  const fullManifestUrl = `${addonOrigin}${getUrlPath()}`;

  const copyTextToClipboard = useCallback(
    (text: string, successMessage: string, fallbackPrefix?: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            showToastMessage(successMessage);
          })
          .catch(() => {
            showToastMessage(`${fallbackPrefix || '📋'} ${text}`);
          });
      } else {
        showToastMessage(`${fallbackPrefix || '📋'} ${text}`);
      }
    },
    [showToastMessage]
  );

  const handleOpenAdvancedSettings = () => {
    const isAuth =
      sessionStorage.getItem('nuvio_admin_auth') === 'true' ||
      localStorage.getItem('nuvio_admin_auth') === 'true';
    if (!isAuth) {
      setIsAdminAuthOpen(true);
      return;
    }
    setIsSettingsOpen(true);
  };

  const handleAdminAuthenticated = () => {
    try {
      sessionStorage.setItem('nuvio_admin_auth', 'true');
    } catch {
      // ignore
    }
    setIsAdminAuthOpen(false);
    showToastMessage('🔓 Mở khóa Cài Đặt PRO thành công!');
    setIsSettingsOpen(true);
  };

  const handleLockAdmin = () => {
    try {
      sessionStorage.removeItem('nuvio_admin_auth');
      localStorage.removeItem('nuvio_admin_auth');
    } catch {
      // ignore
    }
    setIsSettingsOpen(false);
    showToastMessage('🔒 Đã khóa giao diện Cài Đặt PRO!');
  };

  const handleToggleCatalog = (id: string) => {
    setSelectedCatalogs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveMovieApi = async () => {
    const val = customMovieApi.trim();
    const parsedUrls = parseMultipleUrls(val);
    setIsSavingMovieApi(true);
    try {
      localStorage.setItem('tungnui_custom_movie_api', val);
      const res = await previewFetch('/api/settings/movie-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: val, urls: parsedUrls }),
      });
      const data = await res.json();
      setMovieApiSavedBadge(true);
      setTimeout(() => setMovieApiSavedBadge(false), 3000);
      if (data.endpoints) setCustomEndpoints(data.endpoints);
      showToastMessage(`✅ ${data.message || 'Đã lưu nguồn phim API mới thành công!'}`);
    } catch {
      showToastMessage('⚠️ Đã lưu URL API vào cấu hình trình duyệt!');
    } finally {
      setIsSavingMovieApi(false);
    }
  };

  const handleUnlock18Click = () => {
    if (is18Unlocked) {
      setAdultExpanded((prev) => !prev);
      return;
    }
    setIsUnlock18ModalOpen(true);
  };

  const handleUnlock18Success = () => {
    setIs18Unlocked(true);
    setAdultExpanded(true);
    try {
      localStorage.setItem('nuvio_18_unlocked', 'true');
    } catch {
      // ignore
    }
    const adultIds = adultCatalogs.map((c) => c.id);
    setSelectedCatalogs((prev) => Array.from(new Set([...prev, ...adultIds])));
    setIsUnlock18ModalOpen(false);
    showToastMessage('🔓 Đã mở khóa danh mục 18+ thành công!');
  };

  const handleLogout = useCallback(() => {
    setShowLandingGate(true);
    showToastMessage('ℹ️ Đang xem Trang Giới Thiệu & Tải APK (Bấm Vào Xem Ngay để quay lại).');
  }, [showToastMessage]);

  if (showLandingGate) {
    return (
      <>
        <LandingSecurityGate
          onAuthenticated={(token) => {
            setPreviewJwtToken(token || getStoredPreviewJwt() || 'auto_authorized');
            setShowLandingGate(false);
          }}
          onShowToast={showToastMessage}
        />
        <div id="toast" className={toastMsg ? 'show' : ''}>
          {toastMsg || '✅ Đã hoàn tất!'}
        </div>
      </>
    );
  }

  return (
    <>
      <PreviewErrorBoundary onRollback={() => setIsClassicAddonModalOpen(true)}>
        {uiMode === 'tv' ? (
          <AndroidTvApp
            onSwitchToWebMode={() => handleSwitchUiMode('web')}
            onOpenClassicAddon={() => setIsClassicAddonModalOpen(true)}
            onCheckUpdates={() => setIsUpdateCheckerOpen(true)}
            onSelectMedia={(item) => {
              setPreviewTarget({
                streamUrl: appendPreviewJwtToUrl(`/stream/${item.type}/${item.id}.json`),
                streamName: item.name,
                streamType: item.type === 'tv' ? 'tv' : 'vod',
              });
            }}
            onPlayDirectStream={(target) => {
              setPreviewTarget({
                streamUrl:
                  target.streamUrl || target.directPlayUrl || target.fallbackEmbedUrl || '',
                directPlayUrl: target.directPlayUrl,
                fallbackEmbedUrl: target.fallbackEmbedUrl,
                kidHex: target.kidHex,
                keyHex: target.keyHex,
                streamName: target.streamName,
                streamType:
                  target.streamType === 'dash'
                    ? 'dash'
                    : target.streamType === 'tv'
                    ? 'tv'
                    : 'vod',
              });
            }}
            onShowToast={showToastMessage}
          />
        ) : uiMode === 'mobitv' ? (
          <MobileCinemaApp
            onSwitchToTvMode={() => handleSwitchUiMode('web')}
            onCheckUpdates={() => setIsUpdateCheckerOpen(true)}
            onOpenClassicAddon={() => setIsClassicAddonModalOpen(true)}
            onOpenAddonSettings={handleOpenAdvancedSettings}
            onCopyManifestUrl={() =>
              copyTextToClipboard(
                fullManifestUrl,
                '✅ Đã sao chép Link Manifest thành công!',
                '📋 Manifest:'
              )
            }
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onSelectMedia={(item) => {
              setPreviewTarget({
                streamUrl: appendPreviewJwtToUrl(`/stream/${item.type}/${item.id}.json`),
                streamName: item.name,
                streamType: item.type === 'tv' ? 'tv' : 'vod',
              });
            }}
            onPlayDirectStream={(target) => {
              setPreviewTarget({
                streamUrl:
                  target.streamUrl || target.directPlayUrl || target.fallbackEmbedUrl || '',
                directPlayUrl: target.directPlayUrl,
                fallbackEmbedUrl: target.fallbackEmbedUrl,
                kidHex: target.kidHex,
                keyHex: target.keyHex,
                streamName: target.streamName,
                streamType:
                  target.streamType === 'dash'
                    ? 'dash'
                    : target.streamType === 'tv'
                    ? 'tv'
                    : 'vod',
              });
            }}
            onShowToast={showToastMessage}
            onLogout={handleLogout}
          />
        ) : (
          <PreviewWebApp
            onRollbackToClassic={() => setIsClassicAddonModalOpen(true)}
            onOpenAddonSettings={handleOpenAdvancedSettings}
            onOpenClassicAddon={() => setIsClassicAddonModalOpen(true)}
            onCopyManifestUrl={() =>
              copyTextToClipboard(
                fullManifestUrl,
                '✅ Đã sao chép Link Manifest thành công!',
                '📋 Manifest:'
              )
            }
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onShowToast={showToastMessage}
            onSwitchToTvMode={() => handleSwitchUiMode('tv')}
            onCheckUpdates={() => setIsUpdateCheckerOpen(true)}
            onLogout={handleLogout}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            currentMusicTrack={currentMusicTrack}
            isMusicPlaying={isMusicPlaying}
            musicFavorites={musicFavorites}
            onPlayMusicTrack={handlePlayMusicTrack}
            onToggleMusicPlay={handleToggleMusicPlay}
            onNextMusicTrack={handleNextMusicTrack}
            onPrevMusicTrack={handlePrevMusicTrack}
            onToggleMusicFavorite={handleToggleMusicFavorite}
            onCloseMusicPlayer={handleCloseMusicPlayer}
          />
        )}
      </PreviewErrorBoundary>

      {/* IN-APP AUTO-UPDATE CHECKER MODAL */}
      <AppUpdateChecker
        isOpenManual={isUpdateCheckerOpen}
        onCloseManual={() => setIsUpdateCheckerOpen(false)}
        onShowToast={showToastMessage}
        isTvMode={uiMode === 'tv'}
      />

      {/* CLASSIC ADDON CONFIGURATION MODAL (MATCHING IMAGE 1) */}
      <ClassicAddonModal
        isOpen={isClassicAddonModalOpen}
        onClose={() => setIsClassicAddonModalOpen(false)}
        onOpenAdvancedSettings={handleOpenAdvancedSettings}
        onOpenQrModal={() => setIsQrModalOpen(true)}
        onCopyManifestUrl={() =>
          copyTextToClipboard(
            fullManifestUrl,
            '✅ Đã sao chép Link Manifest thành công!',
            '📋 Manifest:'
          )
        }
        stremioInstallHref={stremioInstallHref}
        tvCatalogs={tvCatalogs}
        movieCatalogs={movieCatalogs}
        selectedCatalogs={selectedCatalogs}
        onToggleCatalog={handleToggleCatalog}
      />

      {/* TOAST */}
      <div id="toast" className={toastMsg ? 'show' : ''}>
        {toastMsg || '✅ Đã hoàn tất!'}
      </div>

      {/* PLAYER PREVIEW MODAL */}
      <PlayerModal
        target={previewTarget}
        onClose={() => setPreviewTarget(null)}
        onCopyUrl={(url) =>
          copyTextToClipboard(url, '📋 Đã sao chép link stream!', '📋 Stream:')
        }
        onShowToast={showToastMessage}
      />

      {/* QR MODAL */}
      <QrModal
        isOpen={isQrModalOpen}
        manifestUrl={fullManifestUrl}
        onClose={() => setIsQrModalOpen(false)}
      />

      {/* UNLOCK 18+ MODAL */}
      <Unlock18Modal
        isOpen={isUnlock18ModalOpen}
        onClose={() => setIsUnlock18ModalOpen(false)}
        onSuccess={handleUnlock18Success}
      />

      {/* ADMIN AUTHENTICATION GATE MODAL */}
      <AdminAuthGateModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onAuthenticated={handleAdminAuthenticated}
      />

      {/* PREVIEW PASSWORD GATE MODAL (Q@z123456 -> 2-HOUR SIGNED JWT) */}
      <PreviewPasswordModal
        isOpen={isPreviewAuthOpen}
        onClose={() => setIsPreviewAuthOpen(false)}
        onAuthenticated={handlePreviewAuthenticated}
      />

      {/* CONDENSED SETTINGS MODAL (CORE HEADER + CUSTOM MOVIE APIS & VOD + API KEYS & INTEGRATIONS) */}
      <AdvancedSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLockAdmin={handleLockAdmin}
        customMovieApi={customMovieApi}
        onCustomMovieApiChange={(val) => {
          setCustomMovieApi(val);
          try {
            localStorage.setItem('tungnui_custom_movie_api', val);
          } catch {
            // ignore
          }
        }}
        customEndpoints={customEndpoints}
        onSaveMovieApi={handleSaveMovieApi}
        isSavingMovieApi={isSavingMovieApi}
        movieApiSavedBadge={movieApiSavedBadge}
        debridKey={debridKey}
        onDebridKeyChange={setDebridKey}
        geminiKey={geminiKey}
        onGeminiKeyChange={setGeminiKey}
        is18Unlocked={is18Unlocked}
        adultExpanded={adultExpanded}
        onHandleUnlock18={handleUnlock18Click}
        adultCatalogs={adultCatalogs}
        selectedCatalogs={selectedCatalogs}
        onToggleCatalog={handleToggleCatalog}
        onShowToast={showToastMessage}
      />

      {/* ROPHIM AUTHENTICATION & GOOGLE LOGIN MODAL */}
      <RoPhimAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserLogin={handleUserLogin}
        onUserLogout={handleUserLogout}
        uiMode={uiMode}
        onSwitchUiMode={handleSwitchUiMode}
        onShowToast={showToastMessage}
      />
    </>
  );
};

export default App;
