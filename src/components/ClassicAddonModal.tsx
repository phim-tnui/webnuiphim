import React from 'react';
import { CatalogItem } from '../types';

interface ClassicAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdvancedSettings: () => void;
  onOpenQrModal: () => void;
  onCopyManifestUrl: () => void;
  stremioInstallHref: string;
  tvCatalogs: CatalogItem[];
  movieCatalogs: CatalogItem[];
  selectedCatalogs: string[];
  onToggleCatalog: (id: string) => void;
}

export const ClassicAddonModal: React.FC<ClassicAddonModalProps> = ({
  isOpen,
  onClose,
  onOpenAdvancedSettings,
  onOpenQrModal,
  onCopyManifestUrl,
  stremioInstallHref,
  tvCatalogs,
  movieCatalogs,
  selectedCatalogs,
  onToggleCatalog,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[620px] rounded-2xl bg-[#0d121d] border border-amber-500/35 shadow-2xl p-4 sm:p-5 text-zinc-100 my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px rgba(245,158,11,0.12)',
        }}
      >
        {/* HEADER BAR (MATCHING IMAGE 1) */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#141b2b] border border-amber-500/30 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🍿</span>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide truncate">
                Danh Mục Nội Dung: <span className="text-amber-400">TRUYỀN HÌNH &amp; PHIM TRUYỆN</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdvancedSettings();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Mở Cài Đặt PRO (Mật khẩu admin)"
            >
              <span>⚙️</span>
              <span>Cài Đặt</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500 text-black text-[9px] font-black">
                PRO
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              title="Đóng bảng tùy chọn"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SECTION 1: TRUYỀN HÌNH (4 PILLS IN 2x2 GRID MATCHING IMAGE 1) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-200">
              <span>📺</span>
              <span>TRUYỀN HÌNH</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Live TV Channels
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tvCatalogs.map((item) => {
              const isChecked = selectedCatalogs.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-amber-500/15 border-amber-500/70 text-amber-300 shadow-sm shadow-amber-500/10'
                      : 'bg-[#121724] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    checked={isChecked}
                    onChange={() => onToggleCatalog(item.id)}
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: PHIM TRUYỆN (15 PILLS IN 3 COLUMNS MATCHING IMAGE 1) */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-200">
              <span>🎬</span>
              <span>PHIM TRUYỆN</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Movies &amp; Series
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {movieCatalogs.map((item) => {
              const isChecked = selectedCatalogs.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-center text-center px-2.5 py-2.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer select-none leading-tight ${
                    isChecked
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/10'
                      : 'bg-[#121724] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isChecked}
                    onChange={() => onToggleCatalog(item.id)}
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS (MATCHING IMAGE 1: CÀI VÀO NUVIO, QUÉT QR, CHÉP LINK MANIFEST) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
          <a
            href={stremioInstallHref}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all text-center no-underline"
          >
            <span>🧩</span>
            <span>CÀI VÀO NUVIO / STREMIO</span>
          </a>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQrModal();
            }}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-[#092926] hover:bg-[#0c3733] border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
          >
            <span>📱</span>
            <span>Quét QR Cài TV</span>
          </button>

          <button
            type="button"
            onClick={onCopyManifestUrl}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-[#141a29] hover:bg-[#1a2236] border border-white/15 text-zinc-200 text-xs font-bold transition-all cursor-pointer"
          >
            <span>📋</span>
            <span>Chép Link Manifest</span>
          </button>
        </div>
      </div>
    </div>
  );
};
