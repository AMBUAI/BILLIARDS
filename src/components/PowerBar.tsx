import React, { useCallback, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';

interface PowerBarProps {
  disabled: boolean;
  power: number;
  mustCallPocketFirst: boolean;
  onPowerChange: (power: number) => void;
  onShoot: (power: number) => void;
}

const HANDLE_HEIGHT_PX = 28;
const HANDLE_HALF_PX = HANDLE_HEIGHT_PX / 2;

export const PowerBar: React.FC<PowerBarProps> = ({
  disabled,
  power,
  mustCallPocketFirst,
  onPowerChange,
  onShoot,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const latestPowerRef = useRef(0);

  const computePowerFromClientY = useCallback((clientY: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const usable = Math.max(1, rect.height - HANDLE_HEIGHT_PX);
    const ratio = (clientY - (rect.top + HANDLE_HALF_PX)) / usable;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      const next = computePowerFromClientY(e.clientY);
      latestPowerRef.current = next;
      onPowerChange(next);
    },
    [computePowerFromClientY, disabled, onPowerChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled) return;
      const next = computePowerFromClientY(e.clientY);
      latestPowerRef.current = next;
      onPowerChange(next);
    },
    [computePowerFromClientY, disabled, isDragging, onPowerChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
      const releasePower = latestPowerRef.current;
      if (!disabled && releasePower >= 0.05) {
        onShoot(releasePower);
      } else {
        onPowerChange(0);
      }
    },
    [disabled, isDragging, onPowerChange, onShoot]
  );

  const clampedPower = Math.max(0, Math.min(1, power));
  const pct = Math.round(clampedPower * 100);

  return (
    <div className="flex h-full flex-col items-center justify-between gap-1 py-1">
      <div className="text-center">
        <div className="text-[9px] font-semibold tracking-wider text-[#d4af37] uppercase">
          Power
        </div>
        <div className="font-mono-nums text-xs font-bold text-[#faf4e6]">
          {pct}%
        </div>
      </div>

      {/* Brass-framed Mahogany Pull-Back Cue Channel */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="Shot power pull-back control"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={`touch-game-surface relative w-12 flex-1 min-h-[120px] rounded-xl border p-1.5 transition-opacity ${
          disabled
            ? 'cursor-not-allowed border-[#d4af37]/15 bg-[#120d0a]/60 opacity-45'
            : 'cursor-grab active:cursor-grabbing border-[#d4af37]/50 bg-gradient-to-b from-[#1e140f] to-[#110b08] shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]'
        }`}
      >
        {/* Inner Slider Channel */}
        <div
          ref={trackRef}
          className="relative h-full w-full rounded-lg bg-[#070908]"
        >
          {/* Power fill bar */}
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            {/* Cancel top strip (<5% releases cancel shot) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[5%] border-b border-white/15" />

            <div
              className={`absolute inset-x-0 top-0 ${isDragging ? '' : 'transition-[height] duration-75'}`}
              style={{
                height: `${pct}%`,
                background:
                  pct > 80
                    ? 'linear-gradient(180deg, #D4AF37 0%, #EA580C 60%, #DC2626 100%)'
                    : pct > 45
                    ? 'linear-gradient(180deg, #10B981 0%, #D4AF37 100%)'
                    : 'linear-gradient(180deg, #0D5C3E 0%, #10B981 100%)',
              }}
            />

            {/* Scale ticks */}
            {[25, 50, 75].map((tick) => (
              <div
                key={tick}
                className="pointer-events-none absolute inset-x-2 border-t border-white/15"
                style={{ top: `${tick}%` }}
              />
            ))}
          </div>

          {/* Miniature Brass, Rosewood & Blue-Chalk Cue Grip Handle moving 0%..100% flush */}
          <div
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center gap-0.5 rounded-md border border-[#f3d06b]/85 bg-gradient-to-b from-[#73361d] via-[#461d0d] to-[#260e06] shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
            style={{
              height: `${HANDLE_HEIGHT_PX}px`,
              top: `calc(${clampedPower * 100}% - ${clampedPower * HANDLE_HEIGHT_PX}px)`,
            }}
          >
            <div className="h-[2.5px] w-4 rounded-sm bg-[#2563eb]" />
            <div className="h-[2px] w-6 rounded-full bg-[#faf5e8]" />
            <div className="h-[2px] w-5 rounded-full bg-[#f3d06b]" />
          </div>
        </div>
      </div>

      {/* Helper label */}
      <div className="flex flex-col items-center text-center leading-tight">
        {mustCallPocketFirst ? (
          <span className="max-w-[56px] text-[9px] font-semibold text-[#f3d06b]">
            Tap pocket
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[9px] text-[#b9af9e]">
            <Crosshair className="h-2.5 w-2.5 text-[#d4af37]" />
            <span>Pull</span>
          </span>
        )}
      </div>
    </div>
  );
};
