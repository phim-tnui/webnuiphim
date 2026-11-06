import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MusicTrack } from '../types';

interface MusicPlayerBarProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onClosePlayer: () => void;
  favorites: string[];
  onToggleFavorite: (trackId: string) => void;
  onShowToast: (msg: string) => void;
  onSwitchTrack?: (track: MusicTrack) => void;
}

export const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onClosePlayer,
  favorites,
  onToggleFavorite,
  onShowToast,
  onSwitchTrack,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(210);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [showMvModal, setShowMvModal] = useState<boolean>(false);
  const [startSecond, setStartSecond] = useState<number>(0);

  // Extract clean 11-character YouTube video ID
  const cleanVideoId = useMemo(() => {
    if (!currentTrack?.id) return '';
    const match = currentTrack.id.match(/([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : currentTrack.id;
  }, [currentTrack?.id]);

  // Keep latest callbacks in ref for timers and listeners
  const onNextTrackRef = useRef(onNextTrack);
  onNextTrackRef.current = onNextTrack;
  const onPrevTrackRef = useRef(onPrevTrack);
  onPrevTrackRef.current = onPrevTrack;
  const onTogglePlayRef = useRef(onTogglePlay);
  onTogglePlayRef.current = onTogglePlay;
  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;
  const onSwitchTrackRef = useRef(onSwitchTrack);
  onSwitchTrackRef.current = onSwitchTrack;

  const isLoopRef = useRef(isLoop);
  isLoopRef.current = isLoop;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // PostMessage helper to send commands to YouTube iframe
  const sendIframeCommand = useCallback((command: string, args: any = '') => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: command,
            args: args ? (Array.isArray(args) ? args : [args]) : [],
          }),
          '*'
        );
      }
    } catch (_) {}
  }, []);

  // When current track changes: Reset scrubber and load new track immediately
  useEffect(() => {
    if (!cleanVideoId) return;

    setCurrentTime(0);
    setStartSecond(0);

    const dur = currentTrack?.durationSec || 210;
    setDuration(dur);

    // Send play command just in case iframe is already loaded
    const timer = setTimeout(() => {
      sendIframeCommand('playVideo');
      sendIframeCommand('setVolume', [isMuted ? 0 : Math.round(volume * 100)]);
    }, 400);

    return () => clearTimeout(timer);
  }, [cleanVideoId, currentTrack?.durationSec, sendIframeCommand, isMuted, volume]);

  // Play / Pause sync
  useEffect(() => {
    if (isPlaying) {
      sendIframeCommand('playVideo');
    } else {
      sendIframeCommand('pauseVideo');
    }
  }, [isPlaying, sendIframeCommand]);

  // Volume & Mute sync
  useEffect(() => {
    const vol = isMuted ? 0 : Math.round(volume * 100);
    sendIframeCommand('setVolume', [vol]);
  }, [volume, isMuted, sendIframeCommand]);

  // Reliable second-by-second playback clock
  useEffect(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);

    if (isPlaying && cleanVideoId) {
      tickTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const maxDur = durationRef.current || 210;
          const next = prev + 1;
          if (next >= maxDur) {
            if (isLoopRef.current) {
              sendIframeCommand('seekTo', [0, true]);
              sendIframeCommand('playVideo');
              return 0;
            } else {
              // Crucial: Schedule onNextTrack asynchronously outside this updater callback
              setTimeout(() => {
                if (onNextTrackRef.current) {
                  onNextTrackRef.current();
                }
              }, 0);
              return 0;
            }
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [isPlaying, cleanVideoId, sendIframeCommand]);

  // Auto-Fallback when YouTube returns an error (unavailable or embedding blocked)
  const handleAutoFallback = useCallback(async () => {
    if (!currentTrack) return;
    try {
      const res = await fetch(
        `/api/music/resolve-fallback?title=${encodeURIComponent(
          currentTrack.title
        )}&artist=${encodeURIComponent(currentTrack.artist)}`
      );
      const data = await res.json();
      if (data.success && data.track && data.track.id !== cleanVideoId) {
        if (onShowToastRef.current) {
          onShowToastRef.current(`🔄 Đã tự động đổi sang nguồn trực tiếp: ${data.track.title}`);
        }
        if (onSwitchTrackRef.current) {
          onSwitchTrackRef.current(data.track);
        }
      }
    } catch (_) {}
  }, [currentTrack, cleanVideoId]);

  // Listen for YouTube iframe postMessage telemetry to calibrate exact seconds
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.data) return;
      try {
        let payload = event.data;
        if (typeof payload === 'string' && payload.startsWith('{')) {
          payload = JSON.parse(payload);
        }
        if (payload && payload.info) {
          // Check for YouTube player errors: 2, 5, 100, 101, 150
          if (
            payload.event === 'onError' ||
            (typeof payload.info === 'number' && [2, 5, 100, 101, 150].includes(payload.info)) ||
            (payload.info.errorCode && [2, 5, 100, 101, 150].includes(payload.info.errorCode))
          ) {
            console.warn('[Music] Video error detected, triggering auto-fallback...');
            setTimeout(() => {
              handleAutoFallback();
            }, 0);
            return;
          }

          if (typeof payload.info.currentTime === 'number' && payload.info.currentTime > 0) {
            setCurrentTime(Math.floor(payload.info.currentTime));
          }
          if (typeof payload.info.duration === 'number' && payload.info.duration > 0) {
            setDuration(Math.floor(payload.info.duration));
          }
          if (payload.info.playerState === 0) {
            // Video ended
            if (isLoopRef.current) {
              sendIframeCommand('seekTo', [0, true]);
              sendIframeCommand('playVideo');
              setCurrentTime(0);
            } else {
              setTimeout(() => {
                if (onNextTrackRef.current) {
                  onNextTrackRef.current();
                }
              }, 0);
            }
          }
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [sendIframeCommand, handleAutoFallback]);

  // MediaSession API Integration (Lockscreen, Notification Shade, Keyboard keys)
  useEffect(() => {
    if (!currentTrack || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'PHIM.TNUI Music 2026',
        artwork: [
          { src: currentTrack.cover || '', sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => onTogglePlayRef.current && onTogglePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => onTogglePlayRef.current && onTogglePlayRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => onPrevTrackRef.current && onPrevTrackRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => onNextTrackRef.current && onNextTrackRef.current());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          const seekVal = Math.floor(details.seekTime);
          setCurrentTime(seekVal);
          sendIframeCommand('seekTo', [seekVal, true]);
        }
      });
    } catch (_) {}
  }, [currentTrack, sendIframeCommand]);

  if (!currentTrack || !cleanVideoId) return null;

  // Handle scrubber drag / seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekVal = parseFloat(e.target.value);
    setCurrentTime(seekVal);
    sendIframeCommand('seekTo', [seekVal, true]);
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isFavorited = favorites.includes(currentTrack.id);

  // Construct official YouTube Embed URL with autoplay and JS API enabled
  const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(
    cleanVideoId
  )}?autoplay=1&enablejsapi=1&playsinline=1&iv_load_policy=3&rel=0&start=${startSecond}`;

  return (
    <>
      {/* =====================================================================
          PERSISTENT RESILIENT YOUTUBE PLAYER CONTAINER
          - Mode Audio Only: Held inside viewport (bottom-2 right-2 w-[160px] h-[90px] opacity-[0.01])
            so browser will NEVER suspend media execution or block playback.
          - Mode Xem MV: Floats into a crisp Picture-in-Picture window at bottom-right corner.
         ===================================================================== */}
      <div
        className={`fixed transition-all duration-300 ${
          showMvModal
            ? 'bottom-20 sm:bottom-24 right-4 sm:right-8 w-80 sm:w-96 rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/60 bg-black z-[1000]'
            : 'bottom-2 right-2 w-[160px] h-[90px] opacity-[0.01] pointer-events-none -z-10'
        }`}
      >
        {showMvModal && (
          <div className="bg-[#121724] px-3 py-1.5 flex items-center justify-between text-xs font-bold border-b border-white/10">
            <span className="text-amber-400 truncate flex items-center gap-1.5 max-w-[280px]">
              <span>🎬</span>
              <span className="truncate">{currentTrack.title}</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAutoFallback}
                className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                title="Tự động tìm kiếm nguồn thay thế trực tiếp nếu video này bị chặn hoặc lỗi"
              >
                <span>🔄</span>
                <span>Đổi Nguồn</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMvModal(false)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                title="Đóng cửa sổ MV"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="w-full aspect-video bg-black flex items-center justify-center">
          <iframe
            ref={iframeRef}
            key={`music-engine-${cleanVideoId}`}
            src={embedUrl}
            title={currentTrack.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {/* =====================================================================
          BOTTOM CINEMA MUSIC BAR
         ===================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-[990] bg-[#0c101c]/95 backdrop-blur-2xl border-t border-amber-500/30 px-3 sm:px-6 py-2.5 shadow-[0_-10px_40px_rgba(0,0,0,0.85)] animate-slide-up">
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-3 sm:gap-6">
          {/* LEFT: TRACK INFO & COVER */}
          <div className="flex items-center gap-3 min-w-0 max-w-[210px] sm:max-w-[300px]">
            <div className="relative group shrink-0">
              <img
                src={currentTrack.cover}
                alt={currentTrack.title}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-amber-500/40 shadow-lg ${
                  isPlaying ? 'ring-2 ring-amber-500/60 shadow-amber-500/20' : ''
                }`}
              />
              <div
                onClick={() => setShowMvModal((prev) => !prev)}
                title="Bấm để xem MV hình ảnh"
                className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <span className="text-white text-xs">🎬</span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h4
                onClick={() => setShowMvModal((prev) => !prev)}
                className="text-xs sm:text-sm font-bold text-white truncate hover:text-amber-400 transition-colors cursor-pointer"
                title={`${currentTrack.title} (Bấm để xem MV)`}
              >
                {currentTrack.title}
              </h4>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5">
                {currentTrack.artist}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onToggleFavorite(currentTrack.id)}
              title={isFavorited ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                isFavorited
                  ? 'text-rose-500 bg-rose-500/15 scale-110'
                  : 'text-zinc-400 hover:text-rose-400 hover:bg-white/5'
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={isFavorited ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          </div>

          {/* CENTER: PLAYBACK CONTROLS & DYNAMIC TICKING SCRUBBER */}
          <div className="flex-1 max-w-[620px] flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={() => {
                  setIsShuffle(!isShuffle);
                  onShowToast(!isShuffle ? '🔀 Đã bật phát ngẫu nhiên' : '➡️ Đã tắt phát ngẫu nhiên');
                }}
                title="Phát ngẫu nhiên"
                className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                  isShuffle ? 'text-amber-400 bg-amber-400/20' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🔀
              </button>

              <button
                type="button"
                onClick={onPrevTrack}
                title="Bài trước đó"
                className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all cursor-pointer font-bold"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                title="Bài tiếp theo"
                className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLoop(!isLoop);
                  onShowToast(!isLoop ? '🔁 Đã bật lặp lại bài hát' : '➡️ Đã tắt lặp lại');
                }}
                title="Lặp lại bài hát"
                className={`p-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                  isLoop ? 'text-amber-400 bg-amber-400/20' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🔁
              </button>
            </div>

            <div className="w-full flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400 font-mono">
              <span className="w-10 text-right">{formatSeconds(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 210}
                step={1}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2 transition-all"
              />
              <span className="w-10">{formatSeconds(duration)}</span>
            </div>
          </div>

          {/* RIGHT: MV TOGGLE & VOLUME */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Toggle MV View Button */}
            <button
              type="button"
              onClick={() => {
                setShowMvModal((prev) => !prev);
                onShowToast(!showMvModal ? '🎬 Đã mở MV hình ảnh' : '🎧 Chế độ chỉ nghe nhạc (Audio Only)');
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                showMvModal
                  ? 'bg-amber-400 text-black border-amber-400 shadow-md'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-amber-300 border-amber-500/30'
              }`}
              title="Chuyển đổi giữa chế độ nghe nhạc nhẹ và xem MV"
            >
              <span>{showMvModal ? '🎧 Chỉ Nghe Nhạc' : '🎬 Xem MV'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-16 sm:w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <button
              type="button"
              onClick={onClosePlayer}
              className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Ẩn thanh phát nhạc"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
