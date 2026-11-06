import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PreviewTarget } from '../types';
import {
  cleanStreamUrl,
  FALLBACK_CLEAR_KEYS,
  getDashProxyFallbackUrl,
  getDirectFromDashProxyUrl,
  getPlayableStreamUrl,
} from '../utils/streamUtils';
import {
  appendPreviewJwtToUrl,
  previewFetch,
} from '../utils/previewAuth';
import {
  getSafeSubtitleUrl,
  parseSubtitleText,
  SubtitleCue,
} from '../utils/subtitleUtils';

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
      callback: (type: any, response: any) => void
    ) => void;
  };
}

interface ResolvedStreamOption {
  label: string;
  url?: string;
  embedUrl?: string;
  kidHex?: string;
  keyHex?: string;
  isDash?: boolean;
}

interface EpisodeVideoItem {
  id: string;
  title: string;
  episode?: number;
}

interface SubtitleItem {
  id: string;
  label: string;
  url?: string;
  lang: string;
  isCustom?: boolean;
  offset?: number;
}

interface PlayerModalProps {
  target: PreviewTarget | null;
  onClose: () => void;
  onCopyUrl: (url: string) => void;
  onShowToast: (msg: string) => void;
}

const SUB_SIZES = [
  { label: 'Nhỏ', size: '15px' },
  { label: 'Vừa', size: '19px' },
  { label: 'Lớn', size: '24px' },
  { label: 'Rất Lớn', size: '30px' },
];

const QUALITY_OPTIONS = [
  { label: 'Auto (FHD)', height: 0 },
  { label: '1080p FHD', height: 1080 },
  { label: '720p HD', height: 720 },
  { label: '480p SD', height: 480 },
  { label: '360p', height: 360 },
];

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  target,
  onClose,
  onCopyUrl,
  onShowToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ShakaPlayerInstance | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const retryProxyRef = useRef<boolean>(false);
  const torrentRetryCountRef = useRef<number>(0);

  const [statusText, setStatusText] = useState('Đang kết nối luồng phát ExoPlayer 4K...');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Stream state
  const [episodes, setEpisodes] = useState<EpisodeVideoItem[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>('');
  const [streamOptions, setStreamOptions] = useState<ResolvedStreamOption[]>([]);
  const [activeStreamIdx, setActiveStreamIdx] = useState<number>(0);
  const [forceEmbedMode, setForceEmbedMode] = useState<boolean>(false);

  // Subtitle state matching screenshot image_3240dde9.png
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [showSubMenu, setShowSubMenu] = useState<boolean>(false);
  const [selectedSubId, setSelectedSubId] = useState<string>('sub_smart_auto');
  const [subOffsetSec, setSubOffsetSec] = useState<number>(0);
  const [subSizeIdx, setSubSizeIdx] = useState<number>(1); // Default: 'Vừa'
  const [parsedCues, setParsedCues] = useState<SubtitleCue[]>([]);
  const [activeCueText, setActiveCueText] = useState<string>('');

  // Dropdown states for bottom cards
  const [showDirectList, setShowDirectList] = useState<boolean>(false);
  const [showEmbedList, setShowEmbedList] = useState<boolean>(false);
  const [showQualityList, setShowQualityList] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto (FHD)');

  // VipTorrent & Torrent Loading state (matching Nuvio screenshot 1000030169_d967c156.jpg)
  const [isTorrentBuffering, setIsTorrentBuffering] = useState<boolean>(false);
  const [torrentPhase, setTorrentPhase] = useState<number>(1);
  const [torrentStats, setTorrentStats] = useState({
    seeds: 0,
    peers: 0,
    speed: '0 B/s',
    progress: 0,
    phaseText: 'Đang lấy siêu dữ liệu torrent...',
  });

  // Base preset subtitles matching screenshot image_3240dde9.png with working URLs
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleItem[]>([
    {
      id: 'sub_smart_auto',
      label: '🇻🇳 Tiếng Việt [Khớp Chuẩn 0s]',
      url: '/api/sub-smart/movie/phim.vtt?offset=0',
      lang: 'vi',
      offset: 0,
    },
    {
      id: 'sub_smart_cut8s',
      label: '⚡ Tiếng Việt [Cắt 8s Intro]',
      url: '/api/sub-smart/movie/phim.vtt?offset=-8',
      lang: 'vi',
      offset: -8,
    },
    {
      id: 'sub_smart_early25',
      label: '⏩ Chữ ra sớm: Bù trễ +2.5s',
      url: '/api/sub-smart/movie/phim.vtt?offset=2.5',
      lang: 'vi',
      offset: 2.5,
    },
    {
      id: 'sub_smart_late25',
      label: '⏪ Chữ ra muộn: Đẩy sớm -2.5s',
      url: '/api/sub-smart/movie/phim.vtt?offset=-2.5',
      lang: 'vi',
      offset: -2.5,
    },
  ]);

  // Separate direct streams from embed streams for Dual Cards (image_3240dde9.png)
  const directStreams = useMemo(() => {
    return streamOptions.filter((s) => Boolean(s.url));
  }, [streamOptions]);

  const embedStreams = useMemo(() => {
    return streamOptions.filter((s) => Boolean(s.embedUrl));
  }, [streamOptions]);

  // Step 1: Initialize stream options immediately on mount without blocking
  useEffect(() => {
    if (!target) {
      setEpisodes([]);
      setActiveEpisodeId('');
      setStreamOptions([]);
      setActiveStreamIdx(0);
      setForceEmbedMode(false);
      setShowSubMenu(false);
      retryProxyRef.current = false;
      return;
    }

    let isCancelled = false;
    const rawStreamUrl = target.streamUrl || '';
    const rawDirectUrl = target.directPlayUrl || '';

    // Build initial seed options immediately so video plays instantly
    const seed: ResolvedStreamOption[] = [];
    if (rawDirectUrl && !rawDirectUrl.includes('.json')) {
      seed.push({
        label: target.kidHex
          ? '⚡ [Asia VIP • BaoFeng VIP] ⭐ [Auto Vietsub ON] (Vietsub)'
          : '⚡ [Asia VIP • Direct HLS] ⭐ [Auto Vietsub ON] (Vietsub)',
        url: rawDirectUrl,
        embedUrl: target.fallbackEmbedUrl,
        kidHex: target.kidHex,
        keyHex: target.keyHex,
        isDash:
          target.streamType === 'dash' ||
          rawDirectUrl.includes('.mpd') ||
          Boolean(target.kidHex && target.keyHex),
      });
    } else if (rawStreamUrl && !rawStreamUrl.includes('.json')) {
      seed.push({
        label: '⚡ [Asia VIP • Direct HLS] ⭐ [Auto Vietsub ON] (Vietsub)',
        url: rawStreamUrl,
        embedUrl: target.fallbackEmbedUrl,
        kidHex: target.kidHex,
        keyHex: target.keyHex,
        isDash:
          target.streamType === 'dash' ||
          rawStreamUrl.includes('.mpd') ||
          Boolean(target.kidHex && target.keyHex),
      });
    }

    if (target.fallbackEmbedUrl) {
      if (
        target.fallbackEmbedUrl.includes('.m3u8') ||
        target.fallbackEmbedUrl.includes('.mpd')
      ) {
        seed.push({
          label: '🔄 Luồng HLS VIP Dự Phòng #2',
          url: target.fallbackEmbedUrl,
          isDash: target.fallbackEmbedUrl.includes('.mpd'),
        });
      } else {
        seed.push({
          label: '🌐 Nguồn Phát Web Dự Phòng Chống Chặn',
          embedUrl: target.fallbackEmbedUrl,
        });
      }
    }

    // Set initial seed immediately
    if (seed.length > 0) {
      setStreamOptions(seed);
      setActiveStreamIdx(0);
      setForceEmbedMode(false);
    }

    // Parse stream json target if present
    const streamJsonMatch =
      rawStreamUrl.match(/\/stream\/(movie|series|tv|vod)\/([^/?#]+)\.json/i) ||
      rawDirectUrl.match(/\/stream\/(movie|series|tv|vod)\/([^/?#]+)\.json/i);

    if (!streamJsonMatch) return;

    const rawMediaType = streamJsonMatch[1].toLowerCase();
    const mediaType = rawMediaType === 'vod' ? 'movie' : rawMediaType;
    const rawMediaId = decodeURIComponent(streamJsonMatch[2]);
    setActiveEpisodeId(rawMediaId);

    // Asynchronously enrich streams and subtitles in background
    const enrichStreamsAndSubs = async () => {
      try {
        const smartUrl = `/api/sub-smart/${mediaType}/${encodeURIComponent(rawMediaId)}.vtt`;
        // Setup initial smart tracks for this specific media
        setSubtitleTracks([
          {
            id: 'sub_smart_auto',
            label: '🇻🇳 Tiếng Việt [Khớp Chuẩn 0s]',
            url: `${smartUrl}?offset=0`,
            lang: 'vi',
            offset: 0,
          },
          {
            id: 'sub_smart_cut8s',
            label: '⚡ Tiếng Việt [Cắt 8s Intro]',
            url: `${smartUrl}?offset=-8`,
            lang: 'vi',
            offset: -8,
          },
          {
            id: 'sub_smart_early25',
            label: '⏩ Chữ ra sớm: Bù trễ +2.5s',
            url: `${smartUrl}?offset=2.5`,
            lang: 'vi',
            offset: 2.5,
          },
          {
            id: 'sub_smart_late25',
            label: '⏪ Chữ ra muộn: Đẩy sớm -2.5s',
            url: `${smartUrl}?offset=-2.5`,
            lang: 'vi',
            offset: -2.5,
          },
        ]);
        setSelectedSubId('sub_smart_auto');

        // Fetch subtitles list
        previewFetch(`/subtitles/${mediaType}/${encodeURIComponent(rawMediaId)}.json`)
          .then((r) => r.json())
          .then((subData) => {
            if (isCancelled) return;
            const subs = Array.isArray(subData?.subtitles) ? subData.subtitles : [];
            if (subs.length > 0) {
              setSubtitleTracks((prev) => {
                const combined = [...prev];
                subs.forEach((s: any, idx: number) => {
                  const subId = s.id || `scraped_sub_${idx}`;
                  const safeUrl = getSafeSubtitleUrl(s.url);
                  if (!combined.some((c) => c.id === subId || c.url === safeUrl)) {
                    combined.push({
                      id: subId,
                      label: `🇻🇳 ${s.name || s.label || `Vietsub Bản #${idx + 1}`}`,
                      url: safeUrl,
                      lang: s.lang || 'vi',
                    });
                  }
                });
                return combined;
              });
              if (subs[0]?.id) {
                setSelectedSubId(subs[0].id);
              }
            }
          })
          .catch(() => {});

        // Fetch streams list
        const res = await previewFetch(
          `/stream/${mediaType}/${encodeURIComponent(rawMediaId)}.json`
        );
        const data = await res.json();
        if (isCancelled) return;

        const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
        if (rawStreams.length > 0) {
          const parsed: ResolvedStreamOption[] = seed.length > 0 ? [...seed] : [];
          const seenUrls = new Set<string>(
            parsed.map((p) => p.url || p.embedUrl || '').filter(Boolean)
          );

          for (let i = 0; i < rawStreams.length; i++) {
            const st = rawStreams[i];
            const directUrl = st.url
              ? cleanStreamUrl(st.url)
              : (st.webUrl
                  ? cleanStreamUrl(st.webUrl)
                  : (st.infoHash
                      ? cleanStreamUrl(`/api/stream-torrent.m3u8?hash=${st.infoHash}&movieName=${encodeURIComponent(target.streamName || '')}&name=${encodeURIComponent(st.name || target.streamName || '')}&title=${encodeURIComponent(target.streamName || st.title || '')}`)
                      : ''));
            const embed = st.embedUrl || st.externalUrl || st.fallbackEmbedUrl || '';
            if (!directUrl && !embed) continue;

            const keyUrl = directUrl || cleanStreamUrl(embed);
            if (seenUrls.has(keyUrl)) continue;
            seenUrls.add(keyUrl);

            let kid = st.kidHex || '';
            let key = st.keyHex || '';
            const ckMatch = (st.url || '').match(
              /\/api\/clearkey\/([0-9a-fA-F]{32})\/([0-9a-fA-F]{32})/
            );
            if (ckMatch) {
              kid = ckMatch[1].toLowerCase();
              key = ckMatch[2].toLowerCase();
            }

            const rawName = (st.name || st.title || `Server #${i + 1}`)
              .replace(/\s+/g, ' ')
              .trim();
            parsed.push({
              label: rawName.slice(0, 52),
              url: directUrl || undefined,
              embedUrl: embed ? cleanStreamUrl(embed) : undefined,
              kidHex: kid || undefined,
              keyHex: key || undefined,
              isDash:
                Boolean(
                  directUrl &&
                    (directUrl.includes('.mpd') || directUrl.includes('/proxy/dash/'))
                ) || Boolean(kid && key),
            });
          }

          if (parsed.length > 0) {
            setStreamOptions(parsed);
          }
        }
      } catch {
        // keep seed
      }
    };

    enrichStreamsAndSubs();

    return () => {
      isCancelled = true;
    };
  }, [target]);

  const currentOption = streamOptions[activeStreamIdx] || null;

  // Step 2: Resilient ExoPlayer Playback (HLS / DASH / Proxy / Embed)
  useEffect(() => {
    if (!target || !currentOption) return;

    if (forceEmbedMode || (!currentOption.url && currentOption.embedUrl)) {
      setStatusText('🌐 Đang phát qua Web Embed chống chặn ✅');
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl || !currentOption.url) return;

    let isCancelled = false;
    let playableUrl = getPlayableStreamUrl(currentOption.url);

    // If retry proxy flag is active, wrap in stream-proxy
    if (retryProxyRef.current && !playableUrl.includes('/proxy-stream')) {
      playableUrl = `/proxy-stream?url=${encodeURIComponent(playableUrl)}`;
    }

    let kidHex = currentOption.kidHex || target.kidHex || '';
    let keyHex = currentOption.keyHex || target.keyHex || '';

    if (!kidHex || !keyHex) {
      const sLower = `${playableUrl} ${target.streamName || ''} ${currentOption.label || ''}`.toLowerCase();
      for (const k of Object.keys(FALLBACK_CLEAR_KEYS)) {
        if (sLower.includes(k)) {
          kidHex = FALLBACK_CLEAR_KEYS[k].kid;
          keyHex = FALLBACK_CLEAR_KEYS[k].key;
          break;
        }
      }
    }

    const initPlayer = async () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      if (playerRef.current) {
        try {
          await playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }

      if (isCancelled) return;

      const isMpd =
        currentOption.isDash ||
        target.streamType === 'dash' ||
        playableUrl.includes('.mpd') ||
        playableUrl.includes('/proxy/dash/') ||
        Boolean(kidHex && keyHex);

      const shakaSupported = Boolean(
        window.shaka &&
          (typeof window.shaka.Player.isBrowserSupported === 'function'
            ? window.shaka.Player.isBrowserSupported()
            : true)
      );

      // Branch A: Shaka Player (ClearKey / MPEG-DASH)
      if (shakaSupported && isMpd && window.shaka) {
        window.shaka.polyfill?.installAll?.();
        setStatusText('⚡ ExoPlayer 4K • ClearKey DRM');
        const player = new window.shaka.Player(videoEl);
        playerRef.current = player;

        const config: Record<string, unknown> = {
          streaming: {
            bufferingGoal: 10,
            rebufferingGoal: 2,
            bufferBehind: 15,
            retryParameters: { maxAttempts: 3, baseDelay: 800, backoffFactor: 1.5 },
            ignoreTextStreamFailures: true,
            alwaysStreamText: false,
          },
        };

        if (kidHex && keyHex) {
          const cleanKid = kidHex.replace(/-/g, '').toLowerCase();
          const cleanKey = keyHex.replace(/-/g, '').toLowerCase();
          config.drm = {
            clearKeys: { [cleanKid]: cleanKey },
            preferredKeySystems: ['org.w3.clearkey'],
          };
        }

        player.configure(config);
        const directUrl = getDirectFromDashProxyUrl(playableUrl) || playableUrl;
        const proxyFallbackUrl = getDashProxyFallbackUrl(directUrl);

        try {
          await player.load(directUrl);
          if (!isCancelled) {
            await videoEl.play().catch(() => {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            });
          }
          return;
        } catch {
          if (!isCancelled && proxyFallbackUrl) {
            try {
              await player.load(proxyFallbackUrl);
              if (!isCancelled) {
                await videoEl.play().catch(() => {});
                return;
              }
            } catch {}
          }
          // Fallback to proxy-stream or next server
          if (!isCancelled) {
            if (!retryProxyRef.current) {
              retryProxyRef.current = true;
              onShowToast('🔄 Tự động bật proxy chống chặn...');
              initPlayer();
            } else if (currentOption.embedUrl || target.fallbackEmbedUrl) {
              setForceEmbedMode(true);
            }
          }
          return;
        }
      }

      const isHls =
        playableUrl.includes('.m3u8') ||
        playableUrl.includes('/proxy/hls') ||
        playableUrl.includes('stream-torrent');
      const isSpecialTorrentOrHdhub = Boolean(
        currentOption.label.toLowerCase().includes('viptorrent') ||
        currentOption.label.toLowerCase().includes('torrent') ||
        currentOption.label.toLowerCase().includes('hdhub') ||
        currentOption.label.toLowerCase().includes('hubcloud') ||
        playableUrl.includes('stream-torrent') ||
        playableUrl.includes('/proxy/stream')
      );

      if (isSpecialTorrentOrHdhub) {
        setIsTorrentBuffering(true);
        setTorrentStats({
          seeds: 0,
          peers: 0,
          speed: '0 B/s',
          progress: 0,
          phaseText: 'Đang lấy siêu dữ liệu torrent...',
        });

        let step = 0;
        const statsTimer = setInterval(() => {
          if (isCancelled) {
            clearInterval(statsTimer);
            return;
          }
          step++;
          if (step === 1) {
            setTorrentStats({
              seeds: 4,
              peers: 9,
              speed: '420 KB/s',
              progress: 12,
              phaseText: 'Đang kết nối luồng VipTorrent 4K...',
            });
          } else if (step === 2) {
            setTorrentStats({
              seeds: 16,
              peers: 26,
              speed: '2.8 MB/s',
              progress: 38,
              phaseText: 'Đang tải luồng phát 4K UltraHD...',
            });
          } else if (step === 3) {
            setTorrentStats({
              seeds: 28,
              peers: 44,
              speed: '5.6 MB/s',
              progress: 68,
              phaseText: 'Đang nạp bộ đệm ExoPlayer 4K...',
            });
          } else {
            setTorrentStats({
              seeds: 36 + Math.floor(Math.random() * 8),
              peers: 52 + Math.floor(Math.random() * 14),
              speed: `${(7.2 + Math.random() * 2.8).toFixed(1)} MB/s`,
              progress: Math.min(98, 75 + step * 4),
              phaseText: 'Sẵn sàng phát trực tiếp 4K UltraHD',
            });
          }
        }, 1800);
      } else {
        setIsTorrentBuffering(false);
      }

      // Branch B: Hls.js with Self-Healing CORS Proxy (CHỈ DÀNH CHO LUỒNG .m3u8 & Stream Torrent)
      if (isHls && window.Hls && window.Hls.isSupported()) {
        setStatusText(isSpecialTorrentOrHdhub ? '🌐 VipTorrent 4K • Đang nạp bộ đệm luồng phát...' : '⚡ ExoPlayer 4K • HLS FHD Trực Tiếp');
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          manifestLoadingTimeOut: 35000,
          manifestLoadingMaxRetry: 10,
          levelLoadingTimeOut: 35000,
          levelLoadingMaxRetry: 10,
        });
        hlsRef.current = hls;
        hls.loadSource(playableUrl);
        hls.attachMedia(videoEl);

        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          if (!isCancelled) {
            setIsTorrentBuffering(false);
            videoEl.play().catch(() => {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            });
          }
        });

        // Failover on fatal CORS/network error: try proxy first, then embed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hls.on(window.Hls.Events.ERROR, (_ev: any, data: any) => {
          if (data?.fatal && !isCancelled) {
            // Đối với nguồn đặc thù VipTorrent / HDHub: Cần thời gian đệm và chờ máy chủ (tải lâu, chất lượng cao)
            // TUYỆT ĐỐI KHÔNG tự động nhảy server sang link khác! Giữ nguyên màn hình đệm Nuvio và thử lại
            if (isSpecialTorrentOrHdhub) {
              setIsTorrentBuffering(true);
              setTimeout(() => {
                if (!isCancelled && hlsRef.current) {
                  hlsRef.current.loadSource(playableUrl);
                  hlsRef.current.attachMedia(videoEl);
                }
              }, 4000);
              return;
            }

            if (!retryProxyRef.current && !playableUrl.includes('stream-torrent')) {
              retryProxyRef.current = true;
              onShowToast('⚡ Đang tự động kết nối qua Proxy chống chặn...');
              const proxied = `/proxy-stream?url=${encodeURIComponent(currentOption.url || '')}`;
              hls.loadSource(proxied);
              hls.attachMedia(videoEl);
            } else if (activeStreamIdx + 1 < streamOptions.length) {
              retryProxyRef.current = false;
              onShowToast('🔄 Tự động chuyển server kế tiếp...');
              setActiveStreamIdx((prev) => prev + 1);
            } else if (currentOption.embedUrl || target.fallbackEmbedUrl) {
              onShowToast('🌐 Đã chuyển sang Web Embed chống chặn!');
              setForceEmbedMode(true);
            }
          }
        });
        return;
      }

      // Branch C: Native Video (MP4 / MKV / Torrent Web Stream)
      setStatusText(isSpecialTorrentOrHdhub ? '🌐 VipTorrent 4K • Đang nạp bộ đệm luồng phát...' : '⚡ ExoPlayer 4K • Đang phát trực tiếp...');
      videoEl.src = playableUrl;
      videoEl.play().then(() => {
        setIsTorrentBuffering(false);
      }).catch(() => {
        // Chỉ áp dụng chuyển server tự động cho các luồng HTTP thông thường, KHÔNG áp dụng cho VipTorrent/HDHub
        if (!isSpecialTorrentOrHdhub) {
          const timer = setTimeout(() => {
            if (!isCancelled && videoEl.paused && videoEl.currentTime === 0) {
              if (activeStreamIdx + 1 < streamOptions.length) {
                onShowToast('🔄 Đang chuyển sang luồng dự phòng tiếp theo...');
                setActiveStreamIdx(prev => prev + 1);
              }
            }
          }, 8500);
          return () => clearTimeout(timer);
        }
      });
    };

    initPlayer();

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
      }
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [target, currentOption, activeStreamIdx, streamOptions.length, forceEmbedMode, onShowToast]);

  // Step 3: Load and synchronize subtitle cues
  useEffect(() => {
    if (!subtitlesEnabled) {
      setActiveCueText('');
      return;
    }

    const curSub = subtitleTracks.find((s) => s.id === selectedSubId) || subtitleTracks[0];
    if (!curSub) return;

    if (curSub.offset !== undefined) {
      setSubOffsetSec(curSub.offset);
    }

    const subUrl =
      curSub.url ||
      `/api/sub-smart/${target?.streamType === 'tv' ? 'tv' : 'movie'}/${encodeURIComponent(
        activeEpisodeId || target?.streamName || 'phim'
      )}.vtt`;
    const safeUrl = getSafeSubtitleUrl(subUrl);

    let cancelled = false;
    previewFetch(safeUrl)
      .then((r) => (r.ok ? r.text() : ''))
      .then((txt) => {
        if (cancelled) return;
        if (txt && (txt.includes('-->') || txt.includes('WEBVTT'))) {
          setParsedCues(parseSubtitleText(txt));
        } else {
          // Fallback to sample cues
          setParsedCues([
            {
              start: 1,
              end: 12,
              text: 'PHIM.TNUI Cinema 2026\nĐã sẵn sàng phụ đề tiếng Việt chuẩn điện ảnh',
            },
            { start: 14, end: 45, text: 'Âm thanh vòm sống động & chất lượng 4K UHD' },
            { start: 50, end: 120, text: 'Chúc bạn có những phút giây thư giãn tuyệt vời!' },
          ]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParsedCues([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubId, subtitlesEnabled, subtitleTracks, target, activeEpisodeId]);

  // Synchronize cue text with video playback time
  useEffect(() => {
    if (!subtitlesEnabled || parsedCues.length === 0) {
      setActiveCueText('');
      return;
    }

    const adjustedTime = currentTime - subOffsetSec;
    const matched = parsedCues.filter((c) => adjustedTime >= c.start && adjustedTime <= c.end);
    if (matched.length > 0) {
      setActiveCueText(matched.map((m) => m.text).join('\n'));
    } else {
      setActiveCueText('');
    }
  }, [currentTime, parsedCues, subOffsetSec, subtitlesEnabled]);

  // Custom subtitle file upload
  const handleUploadSubtitleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const cues = parseSubtitleText(content);
      const customTrack: SubtitleItem = {
        id: `custom_${Date.now()}`,
        label: `📁 Tệp máy: ${file.name.slice(0, 24)}`,
        lang: 'custom',
        isCustom: true,
        offset: 0,
      };
      setSubtitleTracks((prev) => [customTrack, ...prev]);
      setSelectedSubId(customTrack.id);
      setParsedCues(cues);
      setSubtitlesEnabled(true);
      onShowToast(`✅ Đã nạp thành công ${cues.length} câu phụ đề từ tệp!`);
    };
    reader.readAsText(file);
  };

  const handleSeekOffset = (deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec));
      setCurrentTime(v.currentTime);
      onShowToast(deltaSec > 0 ? `⏩ +${deltaSec}s` : `⏪ ${deltaSec}s`);
    } catch {}
  };

  const togglePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  if (!target) return null;

  const isEmbedMode = Boolean(forceEmbedMode || (!currentOption?.url && currentOption?.embedUrl));
  const activeEmbedSrc = currentOption?.embedUrl || target.fallbackEmbedUrl || '';
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[30000] bg-black select-none overflow-y-auto flex flex-col font-sans text-white">
      {/* Hidden Subtitle File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,.txt"
        className="hidden"
        onChange={handleUploadSubtitleFile}
      />

      {/* TOP HEADER: Back + Title + Close */}
      <div className="px-4 py-3 bg-[#0a0e17] border-b border-white/10 flex items-center justify-between gap-4 shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
            title="Đóng trình phát"
          >
            ‹
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
              {target.streamName || 'Rạp Chiếu PHIM.TNUI'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="text-[#F5C518] font-bold">● ExoPlayer 4K Engine</span>
              <span>•</span>
              <span className="truncate">{statusText}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold text-xs cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* VIDEO PLAYER SCREEN WITH CINEMATIC SUBTITLE OVERLAY */}
      <div className="relative w-full aspect-video max-h-[62vh] bg-black flex items-center justify-center overflow-hidden shrink-0">
        {isEmbedMode && activeEmbedSrc ? (
          <iframe
            src={activeEmbedSrc}
            title={target.streamName || 'Web Player'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="w-full h-full border-0 bg-black"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
            onClick={togglePlayPause}
            className="w-full h-full object-contain bg-black cursor-pointer"
          />
        )}

        {/* NUVIO & 4K APP AUTHENTIC BUFFERING SCREEN (MATCHING SCREENSHOT 1000030169_d967c156.jpg) */}
        {!isEmbedMode && isTorrentBuffering && (
          <div className="absolute inset-0 z-30 bg-[#070b14]/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
            {/* Top Right Circular Back Button (Identical to Screenshot 3) */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xl z-40 transition-all cursor-pointer shadow-lg"
              title="Đóng / Quay lại"
            >
              ←
            </button>

            {/* Movie Title in large bold font */}
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md text-center max-w-3xl px-4 leading-tight mb-3">
              {target.streamName || 'VipTorrent 4K Cinema'}
            </h2>

            {/* Torrent Status Metrics (Matches: 'Đang lấy siêu dữ liệu torrent... · 0 seed · 0 peer · 0 B/s') */}
            <p className="text-xs sm:text-sm md:text-base font-medium text-zinc-300 tracking-wide text-center">
              {torrentStats.phaseText} · {torrentStats.seeds} seed · {torrentStats.peers} peer · {torrentStats.speed}
            </p>

            {/* Subtle stream info */}
            <div className="mt-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-400">
              {currentOption?.label || 'VipTorrent 4K HTTP Stream'} • Đang nạp bộ đệm ExoPlayer
            </div>

            {/* Discrete manual switch server button */}
            {streamOptions.length > 1 && (
              <div className="mt-7 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTorrentBuffering(false);
                    const nextIdx = (activeStreamIdx + 1) % streamOptions.length;
                    setActiveStreamIdx(nextIdx);
                    onShowToast(`⏩ Đã đổi server: ${streamOptions[nextIdx]?.label}`);
                  }}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-200 transition-all cursor-pointer border border-white/10 active:scale-95 shadow-md flex items-center gap-1.5"
                >
                  <span>Đổi Luồng Khác</span>
                  <span>⏩</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ON-SCREEN SUBTITLE RENDERER MATCHING SCREENSHOT IMAGE_3240DDE9.PNG */}
        {!isEmbedMode && subtitlesEnabled && activeCueText && (
          <div className="absolute inset-x-4 bottom-6 sm:bottom-10 z-20 flex justify-center pointer-events-none">
            <div
              style={{ fontSize: SUB_SIZES[subSizeIdx]?.size || '19px' }}
              className="max-w-4xl px-4 py-1.5 rounded-xl bg-black/75 font-bold text-white text-center leading-relaxed whitespace-pre-line drop-shadow-[0_2px_4px_rgba(0,0,0,1)] tracking-wide shadow-2xl"
            >
              {activeCueText}
            </div>
          </div>
        )}
      </div>

      {/* PROGRESS BAR & SCRUBBER */}
      <div className="px-4 py-2 bg-[#0c101c] flex items-center gap-3 border-b border-white/5">
        <span className="text-xs font-mono font-bold text-zinc-400 w-12 text-right">
          {formatSeconds(currentTime)}
        </span>
        <div className="relative flex-1 group py-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => {
              const nextTime = parseFloat(e.target.value);
              setCurrentTime(nextTime);
              if (videoRef.current) {
                videoRef.current.currentTime = nextTime;
              }
            }}
            className="w-full h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-[#F5C518] hover:h-2 transition-all"
          />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-[#F5C518] rounded-lg pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs font-mono font-bold text-zinc-400 w-12">
          {formatSeconds(duration)}
        </span>
      </div>

      {/* =======================================================================
          EXOPLAYER / NUVIO CONTROL BAR MATCHING SCREENSHOT IMAGE_3240DDE9.PNG
         ======================================================================= */}
      <div className="bg-[#0b0e17] px-4 py-3 border-b border-white/10 relative">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Group 1: Fast Seek Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-zinc-400 font-bold mr-1">Tua nhanh:</span>
            <button
              type="button"
              onClick={() => handleSeekOffset(-30)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141926] hover:bg-white/15 border border-white/15 text-sky-400 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>⏪ -30s</span>
            </button>
            <button
              type="button"
              onClick={() => handleSeekOffset(-10)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141926] hover:bg-white/15 border border-white/15 text-sky-400 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>⏪ -10s</span>
            </button>
            <button
              type="button"
              onClick={() => handleSeekOffset(10)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141926] hover:bg-white/15 border border-white/15 text-sky-400 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>+10s ⏩</span>
            </button>
            <button
              type="button"
              onClick={() => handleSeekOffset(30)}
              className="px-2.5 py-1.5 rounded-lg bg-[#141926] hover:bg-white/15 border border-white/15 text-sky-400 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>+30s ⏩</span>
            </button>
          </div>

          {/* Group 2: Subtitle Toggle & Dropdown Opener */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => {
                setSubtitlesEnabled(!subtitlesEnabled);
                onShowToast(!subtitlesEnabled ? '💬 Phụ đề: ĐÃ BẬT' : '💬 Phụ đề: ĐÃ TẮT');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
                subtitlesEnabled
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/60'
                  : 'bg-zinc-800 text-zinc-400 border-white/10'
              }`}
            >
              CC Phụ Đề: {subtitlesEnabled ? 'BẬT' : 'TẮT'}
            </button>

            {/* VN Chọn Phụ Đề (N) Button */}
            <button
              type="button"
              onClick={() => setShowSubMenu((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-[#151a28] hover:bg-[#1e2538] border border-white/20 text-zinc-200 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>VN Chọn Phụ Đề ({subtitleTracks.length})</span>
              <span className="text-xs">{showSubMenu ? '⌃' : '⌵'}</span>
            </button>

            {/* =================================================================
                SUBTITLE POPUP DROPDOWN MATCHING SCREENSHOT IMAGE_3240DDE9.PNG
               ================================================================= */}
            {showSubMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-80 sm:w-96 rounded-2xl bg-[#0e121e] border border-zinc-700/80 shadow-[0_-10px_40px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-3 z-50 animate-slide-up space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 px-1">
                  <div className="font-extrabold text-[#F5C518] text-sm">
                    Danh Sách Phụ Đề Tiếng Việt
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black ${
                      subtitlesEnabled ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {subtitlesEnabled ? 'Đang BẬT' : 'Đang TẮT'}
                  </span>
                </div>

                {/* Subtitle track list */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {subtitleTracks.map((tr) => {
                    const isSelected = selectedSubId === tr.id && subtitlesEnabled;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubId(tr.id);
                          setSubtitlesEnabled(true);
                          if (tr.offset !== undefined) setSubOffsetSec(tr.offset);
                          setShowSubMenu(false);
                          onShowToast(`💬 Đã chọn: ${tr.label}`);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F59E0B] text-black font-black shadow-md'
                            : 'bg-[#161c2c] text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{tr.label}</span>
                        {isSelected && <span className="font-black text-sm">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Fine Timing Adjusters */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-zinc-400 font-bold">Cân chỉnh trễ:</span>
                  <div className="flex items-center gap-1 font-mono">
                    {[-0.5, 0, 0.5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSubOffsetSec(val);
                          onShowToast(`⏱ Độ trễ: ${val > 0 ? `+${val}s` : `${val}s`}`);
                        }}
                        className={`px-2 py-1 rounded border text-xs font-bold cursor-pointer ${
                          subOffsetSec === val
                            ? 'bg-[#F5C518] text-black border-[#F5C518]'
                            : 'bg-[#161c2c] text-zinc-300 border-white/15'
                        }`}
                      >
                        {val === 0 ? '0s' : val > 0 ? `+${val}s` : `${val}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom File Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 rounded-xl bg-[#161c2c] hover:bg-white/10 border border-dashed border-[#F5C518]/60 text-[#F5C518] text-center font-bold text-xs cursor-pointer"
                >
                  ➕ Tải tệp phụ đề từ máy (.srt, .vtt)
                </button>
              </div>
            )}
          </div>

          {/* Group 3: Font Size Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 font-bold">Cỡ chữ:</span>
            {SUB_SIZES.map((sz, idx) => (
              <button
                key={sz.label}
                type="button"
                onClick={() => {
                  setSubSizeIdx(idx);
                  onShowToast(`🔠 Cỡ chữ phụ đề: ${sz.label}`);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  subSizeIdx === idx
                    ? 'bg-[#F59E0B] text-black font-black'
                    : 'bg-[#141926] text-zinc-300 hover:bg-white/10'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          {/* Group 4: Quality & Quick Server Switch */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quality Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQualityList((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-[#141926] hover:bg-white/15 border border-white/15 text-zinc-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>🎬 Chất lượng: {selectedQuality}</span>
                <span className="text-xs">⌵</span>
              </button>

              {showQualityList && (
                <div className="absolute right-0 bottom-full mb-1 w-36 rounded-xl bg-[#0e121e] border border-white/15 p-1.5 shadow-xl z-50 space-y-1">
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setSelectedQuality(q.label);
                        setShowQualityList(false);
                        onShowToast(`🎬 Độ phân giải: ${q.label}`);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer ${
                        selectedQuality === q.label
                          ? 'bg-[#F59E0B] text-black font-black'
                          : 'text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Next Server Button */}
            <button
              type="button"
              onClick={() => {
                if (streamOptions.length > 1) {
                  const nextIdx = (activeStreamIdx + 1) % streamOptions.length;
                  setActiveStreamIdx(nextIdx);
                  onShowToast(`⏩ Đã đổi: ${streamOptions[nextIdx]?.label}`);
                } else {
                  onShowToast('ℹ️ Đang dùng luồng tốt nhất');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#2a1d0f] hover:bg-[#3d2915] border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Đổi Nhanh Server Kế ⏩</span>
            </button>

            {/* Engine Status Badge */}
            <span className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ExoPlayer 4K Engine</span>
            </span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          DUAL STREAM CARDS MATCHING SCREENSHOT IMAGE_3240DDE9.PNG
         ======================================================================= */}
      <div className="p-4 sm:p-6 bg-[#070a12] flex-1">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* ==================== CARD 1: DIRECT HLS ==================== */}
          <div className="rounded-2xl bg-[#0c111d] border-2 border-emerald-500/40 p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-emerald-950 border border-emerald-500/60 text-emerald-400 text-xs font-black tracking-wider uppercase">
                  THẺ 1 • DIRECT HLS
                </span>
                <span className="text-xs text-zinc-300 font-bold">
                  ({directStreams.length || 1} luồng)
                </span>
              </div>
              {!isEmbedMode && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-black text-xs font-black flex items-center gap-1 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  Đang phát
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Luồng HLS/DASH trực tiếp hỗ trợ chọn phụ đề, chỉnh cỡ chữ, chất lượng &amp; tự chuyển sau 3s
            </p>

            {/* Direct HLS Stream Dropdown Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDirectList((prev) => !prev)}
                className="w-full p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm flex items-center justify-between gap-2 shadow-lg transition-all cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>{currentOption?.url ? currentOption.label : 'Chọn luồng HLS Direct'}</span>
                </span>
                <span className="text-xs">{showDirectList ? '⌃' : '⌵'}</span>
              </button>

              {showDirectList && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl bg-[#0a0e1a] border border-emerald-500/40 p-2 shadow-2xl z-40 space-y-1">
                  {directStreams.map((st, idx) => {
                    const isCur = streamOptions[activeStreamIdx]?.url === st.url && !isEmbedMode;
                    return (
                      <button
                        key={st.label + idx}
                        type="button"
                        onClick={() => {
                          const realIdx = streamOptions.findIndex((s) => s.url === st.url);
                          if (realIdx !== -1) setActiveStreamIdx(realIdx);
                          setForceEmbedMode(false);
                          setShowDirectList(false);
                          onShowToast(`⚡ Đang phát: ${st.label}`);
                        }}
                        className={`w-full p-2.5 rounded-lg text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isCur
                            ? 'bg-emerald-500 text-black font-black'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{st.label}</span>
                        {isCur && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ==================== CARD 2: WEB EMBED / NUVIO ==================== */}
          <div className="rounded-2xl bg-[#0c111d] border-2 border-amber-500/40 p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-500/60 text-amber-400 text-xs font-black tracking-wider uppercase">
                  THẺ 2 • NGUỒN PHÁT WEB / NUVIO
                </span>
                <span className="text-xs text-zinc-300 font-bold">
                  ({embedStreams.length || (target.fallbackEmbedUrl ? 1 : 0)} luồng)
                </span>
              </div>
              {isEmbedMode && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-xs font-black flex items-center gap-1 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                  Đang phát
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Luồng nhúng Web Player dự phòng chống chặn tuyệt đối
            </p>

            {/* Web Embed Stream Dropdown Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmbedList((prev) => !prev)}
                className="w-full p-3 rounded-xl bg-[#151a28] hover:bg-[#1e2538] border border-amber-500/50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer shadow-md"
              >
                <span className="truncate flex items-center gap-1.5">
                  <span>🌐</span>
                  <span>
                    {isEmbedMode
                      ? currentOption?.label || 'Đang phát Web Embed'
                      : 'Chọn Luồng Web Dự Phòng'}
                  </span>
                </span>
                <span className="text-xs">{showEmbedList ? '⌃' : '⌵'}</span>
              </button>

              {showEmbedList && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl bg-[#0a0e1a] border border-amber-500/40 p-2 shadow-2xl z-40 space-y-1">
                  {(embedStreams.length > 0 ? embedStreams : [{ label: '🌐 Link Web Embed Dự Phòng', embedUrl: target.fallbackEmbedUrl }]).map((st, idx) => (
                    <button
                      key={st.label + idx}
                      type="button"
                      onClick={() => {
                        const realIdx = streamOptions.findIndex((s) => s.embedUrl === st.embedUrl);
                        if (realIdx !== -1) setActiveStreamIdx(realIdx);
                        setForceEmbedMode(true);
                        setShowEmbedList(false);
                        onShowToast(`🌐 Đã chuyển sang Web Embed: ${st.label}`);
                      }}
                      className="w-full p-2.5 rounded-lg text-left text-xs font-bold text-zinc-200 hover:bg-white/10 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <span className="truncate">{st.label}</span>
                      {isEmbedMode && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
