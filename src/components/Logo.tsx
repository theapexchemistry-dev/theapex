import { useState, useEffect } from 'react';
import { StorageService } from '@/lib/storage';

export function Logo({ compact = false }: { compact?: boolean }) {
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

    update(); // read once immediately
    window.addEventListener('apex_storage_updated', update);
    return () => window.removeEventListener('apex_storage_updated', update);
  }, []);

  // 3. Split the name into two parts for the two-tone color effect
  //    e.g. "THE APEX WORLD" → head="THE APEX", tail="WORLD"
  const words = siteName.trim().split(' ');
  const head = words.slice(0, -1).join(' ');   // everything except last word
  const tail = words[words.length - 1];         // last word

  // 4. Render
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoSrc || '/default-logo.png'}
        alt="Site logo"
        className="h-10 w-10 object-contain"
      />
      {!compact && (
        <div>
          <div className="text-lg font-bold tracking-wide">
            {head} <span className="text-primary">{tail}</span>
          </div>
          <div className="text-xs text-muted-foreground">{tagline}</div>
        </div>
      )}
    </div>
  );
}
