import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

export const LandscapeGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const check = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (isPortrait) {
    return (
      <div className="casino-parlor-bg fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center text-[#f5efe2]">
        <div className="mahogany-panel w-full max-w-sm rounded-2xl border border-[#d4af37]/40 p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[#f3d06b]/45 bg-gradient-to-b from-[#11734d] to-[#08422b] text-[#f7da84] shadow-lg">
            <RotateCw className="h-8 w-8 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <h1 className="font-casino gold-title-gradient text-xl font-bold tracking-wide">
            Rotate to Landscape
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#dfd7c8]">
            Grand Regency 8-Ball is crafted exclusively for horizontal landscape play so the entire pool table and controls remain unobstructed.
          </p>
          <p className="mt-4 text-xs text-[#a59b8a]">
            Turn your phone sideways to continue.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
