import { useState, useEffect } from 'react';
import { StorageService } from '../lib/storage';
import apexLogoFallback from '../assets/images/apex_logo_1784882809915.jpg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  compact?: boolean;
}

export function Logo({ size = 'md', variant = 'dark', compact = false }: LogoProps) {
  // 1. Read current values from storage into React state
  const [siteName, setSiteName] = useState(
    StorageService.getSiteName() || 'THE APEX WORLD'
  );
  const [tagline, setTagline] = useState(
    StorageService.getTagline() || 'Empowering Minds, Enriching Futures'
  );
  const [logoSrc, setLogoSrc] = useState(StorageService.getSiteLogo());

  // 2. Subscribe to storage changes
  useEffect(() => {
    const update = () => {
      setSiteName(StorageService.getSiteName() || 'THE APEX WORLD');
      setTagline(StorageService.getTagline() || 'Empowering Minds, Enriching Futures');
      setLogoSrc(StorageService.getSiteLogo());
    };

    update();
    window.addEventListener('apex_storage_updated', update);
    return () => window.removeEventListener('apex_storage_updated', update);
  }, []);

  // 3. Split the name into two parts for the two-tone color effect
  const words = siteName.trim().split(' ');
  const head = words.slice(0, -1).join(' ');
  const tail = words[words.length - 1];

  // Size mapping — responsive: smaller on mobile, normal on sm+
  const sizeMap = {
    sm: { img: 'h-8 w-8', title: 'text-sm', sub: 'text-[10px]' },
    md: { img: 'h-9 w-9 sm:h-10 sm:w-10', title: 'text-sm sm:text-lg', sub: 'text-[10px] sm:text-xs' },
    lg: { img: 'h-12 w-12 sm:h-14 sm:w-14', title: 'text-xl sm:text-2xl', sub: 'text-xs sm:text-sm' }
  };
  const s = sizeMap[size];

  // Variant colors
  const isDark = variant === 'dark';
  const titleColor = isDark ? 'text-white' : 'text-slate-900';
  const accentColor = isDark ? 'text-amber-400' : 'text-indigo-600';
  const subColor = isDark ? 'text-slate-300' : 'text-slate-500';

  return (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <img
        src={logoSrc || apexLogoFallback}
        alt="Site logo"
        className={`${s.img} object-contain rounded-full shrink-0`}
      />
      {!compact && (
        <div className="min-w-0">
          <div className={`${s.title} font-black tracking-tight ${titleColor} leading-tight whitespace-nowrap`}>
            {head} <span className={accentColor}>{tail}</span>
          </div>
          <div className={`${s.sub} ${subColor} font-medium leading-tight truncate`}>
            {tagline}
          </div>
        </div>
      )}
    </div>
  );
}
