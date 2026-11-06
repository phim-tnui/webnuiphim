import React, { useEffect, useRef, useState } from 'react';
import { PreviewTarget } from '../types';
import {
  FALLBACK_CLEAR_KEYS,
  getDashProxyFallbackUrl,
  getDirectFromDashProxyUrl,
  getPlayableStreamUrl,
} from '../utils/streamUtils';
import { appendPreviewJwtToUrl, previewFetch } from '../utils/previewAuth';
import { BrandLogo } from './BrandLogo';

declare global {
  interface Window {
    shaka?: {
      Player: {
        new (video: HTMLVideoElement): ShakaPlayerInstance;
        isBrowserSupported?: () => boolean;
        isTypeSupported?: (mimeType: string) => boolean;
      };
      polyfill?: {
        installAll?: () => void;
      };
      net: {
        NetworkingEngine: {
          RequestType: {
            MANIFEST: number;
          };
        };
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Hls?: any;
  }
}

interface ShakaPlayerInstance {
  destroy: () => Promise<void>;
  configure: (config: Record<string, unknown>) => void;
  load: (url: string) => Promise<void>;
  getVariantTracks?: () => Array<{ id: number; height: number }>;
  selectVariantTrack?: (track: { id: number; height: number }, clearBuffer?: boolean) => void;
  getNetworkingEngine: () => {
    registerRequestFilter?: (
      callback: (
        type: number,
        request: { uris?: string[]; headers?: Record<string, string> }
      ) => void
    ) => void;
    registerResponseFilter: (
      callback: (type: number, response: { data: BufferSource }) => void
    ) => void;
  };
}

interface PlayerModalProps {
  target: PreviewTarget | null;
  onClose: () => void;
  onCopyUrl: (url: string) => void;
  onShowToast: (msg: string) => void;
}

interface ResolvedStreamOption {
  label: string;
  url: string;
  embedUrl?: string;
  kidHex?: string;
  keyHex?: string;
}

interface EpisodeOption {
  id: string;
  title: string;
  episode?: number;
}

const ASPECT_MODES: Array<'contain' | 'cover' | 'fill'> = ['contain', 'cover', 'fill'];
const ASPECT_LABELS = ['Vừa Màn Hình', 'Tràn Viền 16:9', 'Toàn Khung'];
const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 2.0];

export const PlayerModal: React.FC<PlayerModalProps> = ({
  target,
  onClose,
  onCopyUrl,
  onShowToast,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ShakaPlayerInstance | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);

  const [statusText, setStatusText] = useState('Đang chuẩn bị luồng phát 4K...');
  const [aspectIdx, setAspectIdx] = useState(0);
  const [playbackRateIdx, setPlaybackRateIdx] = useState(1); // 1.0x
  const [resolvedKid, setResolvedKid] = useState('');
  const [resolvedKey, setResolvedKey] = useState('');

  // Dynamic Stream & Episode Resolution for Stremio /stream/{type}/{id}.json URLs
  const [streamOptions, setStreamOptions] = useState<ResolvedStreamOption[]>([]);
  const [selectedStreamIdx, setSelectedStreamIdx] = useState(0);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeOption[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('');
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);

  // Extract mediaType and mediaId if target.streamUrl is a /stream/{type}/{id}.json endpoint
  useEffect(() => {
    if (!target) return;

    let isCancelled = false;
    setStreamOptions([]);
    setSelectedStreamIdx(0);
    setActiveEmbedUrl(null);
    setEpisodes([]);
    setShowEpisodeDrawer(false);

    const rawUrl = target.streamUrl || '';
    const streamEndpointMatch = rawUrl.match(/\/stream\/(movie|series|tv)\/([^/?#]+)\.json/i);

    const loadStremioMetadataAndStreams = async () => {
      if (!streamEndpointMatch) {
        // Direct URL (e.g., m3u8 / mpd)
        setStreamOptions([
          {
            label: 'Luồng Chính (VIP 1)',
            url: rawUrl,
            kidHex: target.kidHex,
            keyHex: target.keyHex,
          },
        ]);
        return;
      }

      const mediaType = streamEndpointMatch[1].toLowerCase();
      const rawMediaId = decodeURIComponent(streamEndpointMatch[2]);
      const baseSeriesId = rawMediaId.includes(':') ? rawMediaId.split(':')[0] : rawMediaId;
      setActiveEpisodeId(rawMediaId);

      // 1. Fetch Meta (for episode list if series/movie)
      if (mediaType !== 'tv') {
        previewFetch(`/meta/${mediaType}/${encodeURIComponent(baseSeriesId)}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((metaData) => {
            if (isCancelled || !metaData?.meta) return;
            const vids = Array.isArray(metaData.meta.videos) ? metaData.meta.videos : [];
            if (vids.length > 0) {
              const mappedEps: EpisodeOption[] = vids.map((v: any, idx: number) => ({
                id: String(v.id || `${baseSeriesId}:1:${idx + 1}`),
                title: String(v.title || `Tập ${v.episode || idx + 1}`),
                episode: Number(v.episode) || idx + 1,
              }));
              setEpisodes(mappedEps);
              if (!rawMediaId.includes(':') && mappedEps[0]) {
                setActiveEpisodeId(mappedEps[0].id);
              }
            }
          })
          .catch(() => {});
      }

      // 2. Fetch Streams for current target
      await fetchStreamsForEndpoint(`/stream/${mediaType}/${encodeURIComponent(rawMediaId)}.json`);
    };

    const fetchStreamsForEndpoint = async (endpointPath: string) => {
      setStatusText('Đang dò luồng phát tốc độ cao...');
      try {
        const res = await previewFetch(endpointPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isCancelled) return;

        const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
        const parsedOptions: ResolvedStreamOption[] = [];

        for (let i = 0; i < rawStreams.length; i++) {
          const st = rawStreams[i];
          const playUrl = st.url || st.externalUrl || '';
          const embed = st.embedUrl || st.fallbackEmbedUrl || '';
          if (!playUrl && !embed) continue;

          const cleanLabel =
            (st.name || st.title || `Server #${i + 1}`)
              .replace(/\n+/g, ' · ')
              .slice(0, 48) || `Server #${i + 1}`;

          parsedOptions.push({
            label: cleanLabel,
            url: playUrl,
            embedUrl: !playUrl && embed ? embed : st.fallbackEmbedUrl,
            kidHex: st.kidHex,
            keyHex: st.keyHex,
          });
        }

        if (parsedOptions.length > 0) {
          setStreamOptions(parsedOptions);
          setSelectedStreamIdx(0);
        } else {
          setStatusText('Không tìm thấy luồng phát khả dụng cho mục này.');
        }
      } catch {
        if (!isCancelled) {
          setStatusText('Không thể tải danh sách server phát.');
        }
      }
    };

    loadStremioMetadataAndStreams();

    return () => {
      isCancelled = true;
    };
  }, [target]);

  // Switch episode inside PlayerModal
  const handleSelectEpisode = async (ep: EpisodeOption) => {
    setActiveEpisodeId(ep.id);
    setShowEpisodeDrawer(false);
    setStatusText(`Đang chuyển sang ${ep.title}...`);
    try {
      const res = await previewFetch(`/stream/series/${encodeURIComponent(ep.id)}.json`);
      if (res.ok) {
        const data = await res.json();
        const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
        const parsedOptions: ResolvedStreamOption[] = [];
        for (let i = 0; i < rawStreams.length; i++) {
          const st = rawStreams[i];
          const playUrl = st.url || st.externalUrl || '';
          const embed = st.embedUrl || st.fallbackEmbedUrl || '';
          if (!playUrl && !embed) continue;
          parsedOptions.push({
            label: (st.name || st.title || `Server #${i + 1}`).replace(/\n+/g, ' · ').slice(0, 48),
            url: playUrl,
            embedUrl: !playUrl && embed ? embed : st.fallbackEmbedUrl,
            kidHex: st.kidHex,
            keyHex: st.keyHex,
          });
        }
        if (parsedOptions.length > 0) {
          setStreamOptions(parsedOptions);
          setSelectedStreamIdx(0);
          onShowToast(`🎬 Đang phát: ${ep.title}`);
        }
      }
    } catch {
      onShowToast('⚠️ Lỗi khi chuyển tập, vui lòng thử lại.');
    }
  };

  // Initialize Shaka / HLS / Native Video when streamOptions[selectedStreamIdx] changes
  useEffect(() => {
    const activeOpt = streamOptions[selectedStreamIdx];
    if (!activeOpt) return;

    if (!activeOpt.url && activeOpt.embedUrl) {
      setActiveEmbedUrl(activeOpt.embedUrl);
      setStatusText(`Đang phát qua Web Cloud Player (${activeOpt.label})`);
      return;
    }

    setActiveEmbedUrl(null);
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let isCancelled = false;
    const playableUrl = appendPreviewJwtToUrl(getPlayableStreamUrl(activeOpt.url));
    let kidHex = activeOpt.kidHex || target?.kidHex || '';
    let keyHex = activeOpt.keyHex || target?.keyHex || '';

    if (!kidHex || !keyHex) {
      const sLower = `${activeOpt.url} ${target?.streamName || ''}`.toLowerCase();
      for (const k of Object.keys(FALLBACK_CLEAR_KEYS)) {
        if (sLower.includes(k)) {
          kidHex = FALLBACK_CLEAR_KEYS[k].kid;
          keyHex = FALLBACK_CLEAR_KEYS[k].key;
          break;
        }
      }
    }

    setResolvedKid(kidHex);
    setResolvedKey(keyHex);

    const initPlayer = async () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
      if (playerRef.current) {
        try {
          await playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      if (isCancelled) return;

      const isMpd =
        target?.streamType === 'dash' ||
        playableUrl.includes('.mpd') ||
        playableUrl.includes('/proxy/dash/') ||
        activeOpt.url.includes('.mpd') ||
        Boolean(kidHex && keyHex);

      const shakaSupported = Boolean(
        window.shaka &&
          (typeof window.shaka.Player.isBrowserSupported === 'function'
            ? window.shaka.Player.isBrowserSupported()
            : true)
      );

      if (shakaSupported && isMpd && window.shaka) {
        window.shaka.polyfill?.installAll?.();
        setStatusText('Đang khởi chạy Shaka 4K Engine (MPEG-DASH)...');
        const player = new window.shaka.Player(videoEl);
        playerRef.current = player;

        const config: Record<string, unknown> = {
          streaming: {
            bufferingGoal: 12,
            rebufferingGoal: 2,
            bufferBehind: 15,
            retryParameters: { maxAttempts: 3, baseDelay: 800, backoffFactor: 1.5 },
            ignoreTextStreamFailures: true,
            alwaysStreamText: false,
          },
          manifest: {
            retryParameters: { maxAttempts: 3 },
          },
        };

        if (kidHex && keyHex) {
          const cleanKid = kidHex.replace(/-/g, '').toLowerCase();
          const cleanKey = keyHex.replace(/-/g, '').toLowerCase();
          const drmConf: Record<string, string> = {
            [cleanKid]: cleanKey,
          };
          if (cleanKid.length === 32) {
            const dashed = `${cleanKid.slice(0, 8)}-${cleanKid.slice(8, 12)}-${cleanKid.slice(
              12,
              16
            )}-${cleanKid.slice(16, 20)}-${cleanKid.slice(20)}`;
            drmConf[dashed] = cleanKey;
          }
          config.drm = {
            clearKeys: drmConf,
            preferredKeySystems: ['org.w3.clearkey'],
          };
        }

        player.configure(config);

        const directUrl = getDirectFromDashProxyUrl(playableUrl) || playableUrl;
        const proxyFallbackUrl = getDashProxyFallbackUrl(directUrl);

        try {
          await player.load(directUrl);
          if (!isCancelled) {
            setStatusText(`Đang phát 4K DASH · ${activeOpt.label}`);
            try {
              await videoEl.play();
            } catch {
              videoEl.muted = true;
              await videoEl.play().catch(() => {});
            }
          }
          return;
        } catch {
          if (!isCancelled && proxyFallbackUrl && proxyFallbackUrl !== directUrl) {
            try {
              await player.load(proxyFallbackUrl);
              if (!isCancelled) {
                setStatusText(`Đang phát DASH Proxy · ${activeOpt.label}`);
                await videoEl.play().catch(() => {});
              }
              return;
            } catch {
              // continue to fallback
            }
          }
        }
      }

      if (window.Hls && window.Hls.isSupported()) {
        setStatusText(`Đang kết nối luồng HLS · ${activeOpt.label}...`);
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(playableUrl);
        hls.attachMedia(videoEl);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          if (!isCancelled) {
            setStatusText(`Đang phát trực tiếp · ${activeOpt.label}`);
            videoEl.play().catch(() => {});
          }
        });
        hls.on(window.Hls.Events.ERROR, (_ev: unknown, data: { fatal?: boolean }) => {
          if (data?.fatal && !isCancelled) {
            if (activeOpt.embedUrl) {
              setActiveEmbedUrl(activeOpt.embedUrl);
              setStatusText(`Tự động chuyển sang Cloud Embed · ${activeOpt.label}`);
            } else if (selectedStreamIdx < streamOptions.length - 1) {
              setSelectedStreamIdx((prev) => prev + 1);
            }
          }
        });
        return;
      }

      setStatusText(`Đang phát trực tiếp · ${activeOpt.label}`);
      videoEl.src = playableUrl;
      videoEl.play().catch(() => {});
    };

    initPlayer();

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.src = '';
      }
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [streamOptions, selectedStreamIdx, target]);

  if (!target) return null;

  const activeOpt = streamOptions[selectedStreamIdx];
  const playableUrl = appendPreviewJwtToUrl(
    getPlayableStreamUrl(activeOpt?.url || target.streamUrl)
  );
  const externalWebPlayerHref = appendPreviewJwtToUrl(
    `/api/player?url=${encodeURIComponent(playableUrl)}${
      resolvedKid ? `&kid=${encodeURIComponent(resolvedKid)}` : ''
    }${resolvedKey ? `&key=${encodeURIComponent(resolvedKey)}` : ''}&name=${encodeURIComponent(
      target.streamName || 'PHIM.TNUI'
    )}`
  );

  const handleSeek = (deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, (v.currentTime || 0) + deltaSeconds);
    onShowToast(deltaSeconds > 0 ? `⏩ Tua tới +${deltaSeconds}s` : `⏪ Tua lùi ${deltaSeconds}s`);
  };

  const handleCycleAspect = () => {
    const nextIdx = (aspectIdx + 1) % ASPECT_MODES.length;
    setAspectIdx(nextIdx);
    onShowToast(`📐 Khung hình: ${ASPECT_LABELS[nextIdx]}`);
  };

  const handleCycleSpeed = () => {
    const nextIdx = (playbackRateIdx + 1) % PLAYBACK_RATES.length;
    setPlaybackRateIdx(nextIdx);
    const rate = PLAYBACK_RATES[nextIdx];
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    onShowToast(`⚡ Tốc độ phát: ${rate}x`);
  };

  const handleToggleFullscreen = () => {
    const el = containerRef.current || videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleTogglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture();
      }
    } catch {
      onShowToast('Thiết bị không hỗ trợ Picture-in-Picture');
    }
  };

  const currentEpIndex = episodes.findIndex((e) => e.id === activeEpisodeId);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col justify-between bg-[#06080F] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP GLASS BAR */}
        <header className="px-4 sm:px-6 py-3 bg-gradient-to-b from-black/90 via-black/70 to-transparent border-b border-white/10 flex items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-amber-400 hover:text-black focus:ring-4 focus:ring-amber-400 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <span>←</span>
              <span>Quay lại</span>
            </button>
            <BrandLogo variant="icon" size="sm" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white truncate">
                {target.streamName || 'Trình Phát 4K PHIM.TNUI'}
              </h2>
              <p className="text-[11px] text-amber-400/90 font-medium truncate">{statusText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {episodes.length > 1 && (
              <button
                type="button"
                onClick={() => setShowEpisodeDrawer((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-black font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 hover:bg-amber-400 focus:ring-4 focus:ring-white transition-all cursor-pointer"
              >
                <span>📑</span>
                <span>Chọn Tập ({episodes.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-600 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              ✕
            </button>
          </div>
        </header>

        {/* CENTER VIDEO STAGE */}
        <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden">
          {activeEmbedUrl ? (
            <iframe
              src={activeEmbedUrl}
              title={target.streamName || 'Cloud Player'}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              className="w-full h-full max-h-full outline-none"
              style={{ objectFit: ASPECT_MODES[aspectIdx] }}
            />
          )}

          {/* EPISODE DRAWER OVERLAY */}
          {showEpisodeDrawer && episodes.length > 0 && (
            <div className="absolute inset-y-0 right-0 w-full max-w-md bg-[#0B0E17]/95 backdrop-blur-2xl border-l border-white/15 p-5 flex flex-col gap-4 z-30 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-black text-white">Danh Sách Tập Phim</h3>
                  <p className="text-xs text-zinc-400">Tổng cộng {episodes.length} tập</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEpisodeDrawer(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                >
                  Đóng ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 pr-1 content-start">
                {episodes.map((ep) => {
                  const isCur = ep.id === activeEpisodeId;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => handleSelectEpisode(ep)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold truncate transition-all cursor-pointer ${
                        isCur
                          ? 'bg-amber-400 text-black ring-2 ring-white shadow-lg'
                          : 'bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 border border-white/10'
                      }`}
                    >
                      {ep.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM MULTI-FUNCTION CONTROL DECK */}
        <footer className="px-4 sm:px-6 py-3 bg-[#090C15] border-t border-white/10 flex flex-col gap-2.5 z-20">
          {/* Row 1: Server Switcher & Episode Next/Prev */}
          {streamOptions.length > 0 && (
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                  Nguồn phát:
                </span>
                {streamOptions.map((opt, idx) => {
                  const isSel = idx === selectedStreamIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedStreamIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        isSel
                          ? 'bg-amber-400 text-black shadow-md ring-2 ring-amber-200'
                          : 'bg-white/[0.07] hover:bg-white/[0.14] text-zinc-300 border border-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {episodes.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={currentEpIndex <= 0}
                    onClick={() =>
                      currentEpIndex > 0 && handleSelectEpisode(episodes[currentEpIndex - 1])
                    }
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-xs font-bold text-white cursor-pointer"
                  >
                    ⏮ Tập Trước
                  </button>
                  <button
                    type="button"
                    disabled={currentEpIndex < 0 || currentEpIndex >= episodes.length - 1}
                    onClick={() =>
                      currentEpIndex >= 0 &&
                      currentEpIndex < episodes.length - 1 &&
                      handleSelectEpisode(episodes[currentEpIndex + 1])
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 disabled:opacity-35 text-xs font-bold text-amber-300 cursor-pointer"
                  >
                    Tập Tiếp ⏭
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Row 2: Playback Controls (Seek, Speed, Aspect Ratio, PiP, Fullscreen, Copy) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSeek(-10)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                ⏪ -10s
              </button>
              <button
                type="button"
                onClick={() => handleSeek(10)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                +10s ⏩
              </button>
              <button
                type="button"
                onClick={handleCycleSpeed}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                ⚡ Tốc độ: {PLAYBACK_RATES[playbackRateIdx]}x
              </button>
              <button
                type="button"
                onClick={handleCycleAspect}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                📐 {ASPECT_LABELS[aspectIdx]}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePiP}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                🖼️ PiP Thu Nhỏ
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-200 font-semibold cursor-pointer"
              >
                ⛶ Toàn Màn Hình
              </button>
              <a
                href={externalWebPlayerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-bold no-underline"
              >
                🚀 Mở Trình Phát Phụ
              </a>
              <button
                type="button"
                onClick={() => onCopyUrl(playableUrl)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-zinc-300 font-semibold cursor-pointer"
              >
                📋 Chép Link
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
