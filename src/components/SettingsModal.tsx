import React from 'react';
import { BookOpen, Home, Music, Volume2, VolumeX, X } from 'lucide-react';
import { type AudioSettings, soundEngine } from '../audio/soundEngine.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface SettingsModalProps {
  settings: AudioSettings;
  inMatch: boolean;
  onUpdateSettings: (partial: Partial<AudioSettings>) => void;
  onOpenRuleBook: () => void;
  onReturnToMenu: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  inMatch,
  onUpdateSettings,
  onOpenRuleBook,
  onReturnToMenu,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/78 p-3 backdrop-blur-sm">
      <div className="mahogany-panel relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#d4af37]/45">
        <BrassCorners size={16} />
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d4af37]/25 bg-[#1a120e] px-5 py-3">
          <h2 className="font-casino gold-title-gradient text-lg font-bold tracking-wide">
            Settings
          </h2>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onClose();
            }}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/25 bg-[#231813] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#2f211a]"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="casino-scroll overflow-y-auto p-5 space-y-4">
          {/* Sound Effects Toggle & Volume */}
          <div className="rounded-xl border border-[#d4af37]/20 bg-[#100b09]/90 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {settings.sfxEnabled ? (
                  <Volume2 className="h-4 w-4 text-[#d4af37]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#8c8273]" />
                )}
                <span className="text-sm font-semibold text-[#faf4e6]">Sound Effects</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !settings.sfxEnabled;
                  onUpdateSettings({ sfxEnabled: next });
                  if (next) soundEngine.playMenuClick();
                }}
                className={`min-h-[36px] min-w-[74px] rounded-lg px-3 text-xs font-bold transition-colors ${
                  settings.sfxEnabled
                    ? 'bg-[#0b4f35] text-[#f7da84] border border-[#d4af37]/50'
                    : 'bg-[#2a201b] text-[#9c9282] border border-white/10'
                }`}
              >
                {settings.sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-[#b8ae9e]">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.sfxVolume * 100)}
                disabled={!settings.sfxEnabled}
                onChange={(e) =>
                  onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })
                }
                className="h-2 flex-1 cursor-pointer accent-[#d4af37] disabled:opacity-40"
              />
              <span className="font-mono-nums w-10 text-right text-xs text-[#e8decb]">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Music Toggle & Volume */}
          <div className="rounded-xl border border-[#d4af37]/20 bg-[#100b09]/90 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Music
                  className={`h-4 w-4 ${
                    settings.musicEnabled ? 'text-[#d4af37]' : 'text-[#8c8273]'
                  }`}
                />
                <span className="text-sm font-semibold text-[#faf4e6]">Casino Lounge Music</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playMenuClick();
                  onUpdateSettings({ musicEnabled: !settings.musicEnabled });
                }}
                className={`min-h-[36px] min-w-[74px] rounded-lg px-3 text-xs font-bold transition-colors ${
                  settings.musicEnabled
                    ? 'bg-[#0b4f35] text-[#f7da84] border border-[#d4af37]/50'
                    : 'bg-[#2a201b] text-[#9c9282] border border-white/10'
                }`}
              >
                {settings.musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-[#b8ae9e]">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.musicVolume * 100)}
                disabled={!settings.musicEnabled}
                onChange={(e) =>
                  onUpdateSettings({ musicVolume: Number(e.target.value) / 100 })
                }
                className="h-2 flex-1 cursor-pointer accent-[#d4af37] disabled:opacity-40"
              />
              <span className="font-mono-nums w-10 text-right text-xs text-[#e8decb]">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuClick();
                onOpenRuleBook();
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#f3d06b]/55 bg-gradient-to-b from-[#11734d] to-[#08422b] px-4 py-2.5 text-sm font-bold text-[#f7da84] hover:from-[#148458] hover:to-[#0b5639] transition-colors whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4" />
              <span>Rule Book</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuClick();
                onReturnToMenu();
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#261a14] px-4 py-2.5 text-sm font-semibold text-[#faf4e6] hover:bg-[#34241c] transition-colors whitespace-nowrap"
            >
              <Home className="h-4 w-4 text-[#d4af37]" />
              <span>{inMatch ? 'Leave & Menu' : 'Return to Menu'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
