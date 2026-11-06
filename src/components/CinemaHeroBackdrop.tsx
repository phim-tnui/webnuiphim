import React, { useEffect, useState } from 'react';
import { CatalogMetaItem } from './PreviewWebApp';
import { resolveTmdbImages } from '../utils/tmdbImageResolver';

interface CinemaHeroBackdropProps {
  item: CatalogMetaItem;
  className?: string;
  isTvMode?: boolean;
}

/**
 * CinemaHeroBackdrop:
 * Dedicated high-clarity backdrop component for the main spotlight hero frame.
 * 1. Displays the movie's primary backdrop/poster immediately at 0ms delay with crisp clarity.
 * 2. Asynchronously enhances with high-resolution TMDB 4K/FHD master artwork if available.
 * 3. Never shows empty void, never blocks catalog network requests, and blends naturally.
 */
export const CinemaHeroBackdrop: React.FC<CinemaHeroBackdropProps> = ({
  item,
  className = '',
  isTvMode = false,
}) => {
  const initialThumb =
    item.background ||
    item.poster ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1280&auto=format&fit=crop';

  const [highResUrl, setHighResUrl] = useState<string | null>(null);
  const [isHighResLoaded, setIsHighResLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    setIsHighResLoaded(false);
    setHighResUrl(null);

    // Defer high-res resolution by 250ms so all critical catalog API requests finish first
    const timer = setTimeout(() => {
      resolveTmdbImages(item).then((resolved) => {
        if (isCancelled) return;

        const targetUrl =
          (typeof window !== 'undefined' && (window.innerWidth >= 1280 || isTvMode)
            ? resolved.backdrop4k
            : resolved.backdropHd) || resolved.backdropHd;

        if (!targetUrl || targetUrl === initialThumb) {
          setIsHighResLoaded(true);
          return;
        }

        // Preload target high-res backdrop in background
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (!isCancelled) {
            setHighResUrl(targetUrl);
            setIsHighResLoaded(true);
          }
        };
        img.onerror = () => {
          if (!isCancelled) {
            setIsHighResLoaded(true);
          }
        };
        img.src = targetUrl;
      });
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [item.id, item.name, item.originName, item.tmdbId, item.imdbId, isTvMode, initialThumb]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#070a12] select-none ${className}`}>
      {/* 1. PRIMARY CRISP BACKDROP (Displays immediately at 0ms delay) */}
      <img
        src={initialThumb}
        alt={item.name}
        referrerPolicy="no-referrer"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center sm:object-[center_35%] opacity-90 transition-opacity duration-500 scale-100"
        style={{ imageRendering: 'auto' }}
      />

      {/* 2. HIGH-RES MASTER ARTWORK OVERLAY (Seamlessly fades in if resolved) */}
      {highResUrl && isHighResLoaded && (
        <img
          src={highResUrl}
          alt={item.name}
          referrerPolicy="no-referrer"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center sm:object-[center_35%] opacity-95 transition-opacity duration-700 ease-out"
          style={{ imageRendering: 'auto' }}
        />
      )}
    </div>
  );
};
