import React, { useEffect, useState } from 'react';
import { downloadVerifiedBinaryAsset, resolveStaticAssetUrl } from '../utils/previewAuth';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: ReleaseAsset[];
}

export const CURRENT_APP_VERSION = 'v4.0.0';
export const DEFAULT_GITHUB_REPO = 'kimjubim2-bot/Nuvio-addon';

interface AppUpdateCheckerProps {
  repo?: string;
  isOpenManual?: boolean;
  onCloseManual?: () => void;
  onShowToast: (msg: string) => void;
  isTvMode?: boolean;
}

export const AppUpdateChecker: React.FC<AppUpdateCheckerProps> = ({
  repo = DEFAULT_GITHUB_REPO,
  isOpenManual = false,
  onCloseManual,
  onShowToast,
  isTvMode = false,
}) => {
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  const compareVersions = (current: string, latest: string): boolean => {
    try {
      const cleanCur = current.replace(/^v/i, '').trim();
      const cleanLat = latest.replace(/^v/i, '').trim();
      const curParts = cleanCur.split('.').map((n) => parseInt(n, 10) || 0);
      const latParts = cleanLat.split('.').map((n) => parseInt(n, 10) || 0);

      for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
        const c = curParts[i] || 0;
        const l = latParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const checkForUpdates = async (isManual = false) => {
    setIsChecking(true);
    setStatusText('Đang kiểm tra máy chủ GitHub...');
    try {
      const targetRepo =
        localStorage.getItem('tungnui_github_repo') || repo || DEFAULT_GITHUB_REPO;
      const res = await fetch(`https://api.github.com/repos/${targetRepo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) {
        if (res.status === 404) {
          if (isManual) {
            onShowToast(`ℹ️ Chưa có bản phát hành trên GitHub ${targetRepo}.`);
          }
          return;
        }
        throw new Error(`HTTP error ${res.status}`);
      }

      const data: GitHubRelease = await res.json();
      setLatestRelease(data);

      const hasUpdate = compareVersions(CURRENT_APP_VERSION, data.tag_name);
      setIsUpdateAvailable(hasUpdate);

      if (hasUpdate) {
        setIsModalOpen(true);
      } else if (isManual) {
        onShowToast(`✅ Bạn đang dùng phiên bản mới nhất (${CURRENT_APP_VERSION})`);
        setIsModalOpen(true);
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
      if (isManual) {
        onShowToast('⚠️ Không thể kiểm tra cập nhật. Vui lòng thử lại sau.');
      }
    } finally {
      setIsChecking(false);
      setStatusText('');
    }
  };

  // Check once on mount after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // When manual check opened from parent
  useEffect(() => {
    if (isOpenManual) {
      setIsModalOpen(true);
      checkForUpdates(true);
    }
  }, [isOpenManual]);

  const handleClose = () => {
    setIsModalOpen(false);
    if (onCloseManual) onCloseManual();
  };

  if (!isModalOpen && !isOpenManual) return null;

  const targetRepo =
    localStorage.getItem('tungnui_github_repo') || repo || DEFAULT_GITHUB_REPO;

  const mobileApkUrl =
    latestRelease?.assets.find((a) => a.name.toLowerCase().includes('mobi') && a.name.endsWith('.apk'))
      ?.browser_download_url ||
    resolveStaticAssetUrl('apk/PHIMTNUI-MobiTV.apk');

  const tvApkUrl =
    latestRelease?.assets.find(
      (a) =>
        (a.name.toLowerCase().includes('tv') || a.name.toLowerCase().includes('leanback')) &&
        a.name.endsWith('.apk')
    )?.browser_download_url ||
    resolveStaticAssetUrl('apk/PHIMTNUI-AndroidTV.apk');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl bg-[#0f1420] border ${
          isUpdateAvailable ? 'border-amber-500/50 shadow-2xl shadow-amber-500/20' : 'border-white/10'
        } p-6 sm:p-7 text-white space-y-5`}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shadow-lg shrink-0">
              🚀
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {isUpdateAvailable ? 'Có Bản Cập Nhật Mới!' : 'Kiểm Tra Bản Cập Nhật'}
              </h3>
              <p className="text-xs text-zinc-400">
                Mã nguồn mở:{' '}
                <a
                  href={`https://github.com/${targetRepo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline font-mono"
                >
                  github.com/{targetRepo}
                </a>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* VERSION COMPARISON */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#151b29] border border-white/5">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Phiên bản hiện tại
            </span>
            <div className="font-mono font-extrabold text-sm sm:text-base text-zinc-200">
              {CURRENT_APP_VERSION}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Bản phát hành mới nhất
            </span>
            <div className="font-mono font-extrabold text-sm sm:text-base text-amber-300">
              {latestRelease?.tag_name || (isChecking ? 'Đang kiểm tra...' : CURRENT_APP_VERSION)}
            </div>
          </div>
        </div>

        {/* CHANGELOG BODY */}
        {latestRelease?.body && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl bg-black/40 p-3.5 border border-white/5 text-xs text-zinc-300">
            <div className="font-bold text-amber-400 text-xs mb-1">
              📝 Nội dung cập nhật ({latestRelease.name || latestRelease.tag_name}):
            </div>
            <pre className="whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed text-[11px]">
              {latestRelease.body}
            </pre>
          </div>
        )}

        {/* STATUS OR NO UPDATE */}
        {!isUpdateAvailable && !isChecking && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span>✓</span>
            <span>Ứng dụng của bạn đang ở phiên bản mới nhất! Bạn không cần cập nhật.</span>
          </div>
        )}

        {/* ACTION BUTTONS (MOBILE APK & ANDROID TV APK) */}
        <div className="space-y-2.5 pt-2">
          <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Tải File APK Cài Đặt Trực Tiếp:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* MOBILE APK */}
            <a
              href={mobileApkUrl}
              download="PHIMTNUI-MobiTV.apk"
              onClick={(e) => {
                e.preventDefault();
                downloadVerifiedBinaryAsset('apk/PHIMTNUI-MobiTV.apk', 'PHIMTNUI-MobiTV.apk', onShowToast);
              }}
              className={`p-3.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer group ${
                isTvMode
                  ? 'bg-[#182133] hover:bg-amber-500/20 border-white/10'
                  : 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 hover:from-amber-500/30 hover:to-orange-500/20 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                📱
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white truncate">
                  APK Mobile (v4.0.0)
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  Tương thích điện thoại & tablet
                </div>
              </div>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform">➔</span>
            </a>

            {/* ANDROID TV APK */}
            <a
              href={tvApkUrl}
              download="PHIMTNUI-AndroidTV.apk"
              onClick={(e) => {
                e.preventDefault();
                downloadVerifiedBinaryAsset('apk/PHIMTNUI-AndroidTV.apk', 'PHIMTNUI-AndroidTV.apk', onShowToast);
              }}
              className={`p-3.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer group ${
                isTvMode
                  ? 'bg-gradient-to-r from-red-600/30 to-amber-600/20 border-red-500/50 text-white ring-2 ring-white/30'
                  : 'bg-gradient-to-r from-red-500/20 to-purple-500/10 hover:from-red-500/30 hover:to-purple-500/20 border-red-500/40 text-red-300'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                📺
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-white truncate">
                  APK Android TV (v4.0.0)
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  Giao diện Smart TV & Remote D-Pad
                </div>
              </div>
              <span className="text-red-400 group-hover:translate-x-1 transition-transform">➔</span>
            </a>
          </div>
        </div>

        {/* BOTTOM ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
          <button
            type="button"
            disabled={isChecking}
            onClick={() => checkForUpdates(true)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🔄</span>
            <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {latestRelease?.html_url && (
              <a
                href={latestRelease.html_url}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-center font-bold transition-colors"
              >
                Xem trên GitHub
              </a>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
