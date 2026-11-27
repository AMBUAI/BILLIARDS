import React from 'react';
import { Award, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 backdrop-blur-sm">
      <div className="mahogany-panel relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#d4af37]/45">
        <BrassCorners size={16} />
        <div className="flex items-center justify-between border-b border-[#d4af37]/25 bg-[#1a120e] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-[#d4af37]" />
            <h2 className="font-casino gold-title-gradient text-lg font-bold tracking-wide">
              About Grand Regency 8-Ball
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onClose();
            }}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/25 bg-[#231813] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#2f211a]"
            aria-label="Close about"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="casino-scroll overflow-y-auto p-5 space-y-4 text-sm leading-relaxed text-[#dfd7c8]">
          <p>
            <strong className="text-[#f7da84]">Grand Regency 8-Ball</strong> brings the tactile atmosphere of classic 1990s casino billiards halls—mahogany rails, cast brass ornaments, emerald baize, and Tiffany parlor lighting—to a crisp top-down 2D table for both real-time online matches and offline VS Bot play.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#d4af37]/20 bg-[#0e0a08] p-3.5">
              <div className="font-casino text-xs font-bold tracking-wider text-[#d4af37] uppercase">
                How to Play
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-[#d2c9b8]">
                <li>• Drag anywhere on the felt to aim your inlaid cue stick.</li>
                <li>• Hold the − / + buttons on the left for surgical fine-aiming.</li>
                <li>• Tap any table pocket (or the left diagram) to call your pocket.</li>
                <li>• Pull down on the right Power meter and release to strike.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-[#d4af37]/20 bg-[#0e0a08] p-3.5">
              <div className="font-casino text-xs font-bold tracking-wider text-[#d4af37] uppercase">
                Online &amp; Offline Modes
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-[#d2c9b8]">
                <li>• Private 6-character rooms let you warm up immediately until Player 2 joins.</li>
                <li>• Offline VS Bot offers Casual, Club Pro, and Shark AI opponents anywhere.</li>
                <li>• Deterministic 2D physics and full WPA 8-Ball rules on every rack.</li>
              </ul>
            </div>
          </div>

          <div className="brass-divider" />

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="text-xs font-medium tracking-[0.14em] text-[#c7b897]">
              Developed by{' '}
              <span className="font-casino font-bold text-[#f3d06b]">PRAKALP STUDIOS</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuClick();
                onClose();
              }}
              className="min-h-[40px] rounded-xl bg-gradient-to-b from-[#11734d] to-[#08422b] border border-[#f3d06b]/55 px-5 py-2 text-xs font-bold text-[#f7da84] hover:from-[#148458]"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
