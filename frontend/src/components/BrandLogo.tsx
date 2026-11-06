import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  className?: string;
  badgeText?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  subtitle = '4K CINEMA & LIVE TV',
  className = '',
  badgeText,
}) => {
  const iconSizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
    xl: 'w-16 h-16 rounded-2xl',
  }[size];

  const titleSizeClasses = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none group ${className}`}>
      {/* 2026 Obsidian & Champagne Gold Multidimensional Prism Emblem */}
      <div
        className={`relative ${iconSizeClasses} shrink-0 flex items-center justify-center overflow-hidden bg-[#090A0F] border border-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.22)] group-hover:border-amber-300/70 group-hover:shadow-[0_0_32px_rgba(245,158,11,0.38)] transition-all duration-300`}
      >
        {/* Ambient internal glow */}
        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-amber-400/30 blur-md pointer-events-none" />
        <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-rose-600/35 blur-md pointer-events-none" />

        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[78%] h-[78%] drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)] transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            <linearGradient id="phimtnuiGoldGrad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="35%" stopColor="#F59E0B" />
              <stop offset="75%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
            <linearGradient id="phimtnuiPrismAccent" x1="20" y1="14" x2="52" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.85" />
            </linearGradient>
          </defs>

          {/* Outer hexagonal cinema lens frame */}
          <rect
            x="4"
            y="4"
            width="56"
            height="56"
            rx="14"
            fill="#0D101A"
            stroke="url(#phimtnuiGoldGrad)"
            strokeWidth="2.5"
          />

          {/* Left vertical pillar of the stylized 'P' */}
          <path
            d="M17 15C17 13.3431 18.3431 12 20 12H25C26.6569 12 28 13.3431 28 15V49C28 50.6569 26.6569 52 25 52H20C18.3431 52 17 50.6569 17 49V15Z"
            fill="url(#phimtnuiGoldGrad)"
          />

          {/* Play Prism forming the loop of the 'P' */}
          <path
            d="M25 12H36.5C44.5081 12 51 18.4919 51 26.5C51 34.5081 44.5081 41 36.5 41H25V31.5H35.5C38.5376 31.5 41 29.0376 41 26C41 22.9624 38.5376 20.5 35.5 20.5H25V12Z"
            fill="url(#phimtnuiGoldGrad)"
          />

          {/* Inner glowing Play Triangle cut-in */}
          <path
            d="M31 20.5L44.5 28.5L31 36.5V20.5Z"
            fill="url(#phimtnuiPrismAccent)"
          />

          {/* Cinema 4K laser dot */}
          <circle cx="46" cy="48" r="3.2" fill="#F43F5E" />
        </svg>
      </div>

      {variant !== 'icon' && (
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-black tracking-tight text-white ${titleSizeClasses}`}
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              PHIM
            </span>
            <span
              className={`font-black tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent ${titleSizeClasses}`}
              style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}
            >
              .TNUI
            </span>
            {badgeText && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/[0.08] border border-white/15 text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                {badgeText}
              </span>
            )}
          </div>
          {variant === 'full' && subtitle && (
            <span className="text-[9.5px] sm:text-[10px] font-semibold tracking-[0.16em] uppercase text-zinc-400 mt-0.5 truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
