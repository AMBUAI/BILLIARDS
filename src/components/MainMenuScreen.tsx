import React, { useState } from 'react';
import { BookOpen, Bot, Globe, Info, Maximize2, Minimize2, Settings } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine.ts';
import type { ConnectionStatus } from '../hooks/useMultiplayer.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface MainMenuScreenProps {
  connectionStatus: ConnectionStatus;
  isFullscreen: boolean;
  onPlayOnline: () => void;
  onPlayBot: () => void;
  onOpenSettings: () => void;
  onOpenRuleBook: () => void;
  onOpenAbout: () => void;
  onToggleFullscreen: () => void;
}

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
  connectionStatus,
  isFullscreen,
  onPlayOnline,
  onPlayBot,
  onOpenSettings,
  onOpenRuleBook,
  onOpenAbout,
  onToggleFullscreen,
}) => {
  const [iconLoadError, setIconLoadError] = useState(false);

  return (
    <div className="casino-parlor-bg relative flex h-dvh w-screen flex-col items-center justify-between overflow-hidden px-4 py-2.5 sm:px-8 sm:py-4">
      {/* Overhead Tiffany Billiard Lamp Brass Canopy & Warm Amber Wash */}
      <div className="pointer-events-none fixed inset-x-0 top-0 flex flex-col items-center">
        <svg
          viewBox="0 0 360 44"
          className="h-7 sm:h-9 w-72 sm:w-96 opacity-90 drop-shadow-[0_6px_14px_rgba(243,208,107,0.22)]"
          aria-hidden="true"
        >
          <line x1="110" y1="0" x2="110" y2="12" stroke="#d4af37" strokeWidth="2.2" />
          <line x1="250" y1="0" x2="250" y2="12" stroke="#d4af37" strokeWidth="2.2" />
          <path d="M58 28 L76 11 L144 11 L162 28 Z" fill="#0d5e3e" stroke="#f3d06b" strokeWidth="1.4" />
          <path d="M76 11 L98 28 L122 28 L144 11" fill="#d97706" fillOpacity="0.45" stroke="#d4af37" strokeWidth="0.9" />
          <path d="M198 28 L216 11 L284 11 L302 28 Z" fill="#0d5e3e" stroke="#f3d06b" strokeWidth="1.4" />
          <path d="M216 11 L238 28 L262 28 L284 11" fill="#d97706" fillOpacity="0.45" stroke="#d4af37" strokeWidth="0.9" />
          <line x1="104" y1="11" x2="256" y2="11" stroke="#f3d06b" strokeWidth="2.4" />
          <circle cx="180" cy="11" r="4" fill="#f7da84" stroke="#3b2606" strokeWidth="1" />
          <ellipse cx="110" cy="34" rx="56" ry="6" fill="rgba(255,220,130,0.16)" />
          <ellipse cx="250" cy="34" rx="56" ry="6" fill="rgba(255,220,130,0.16)" />
        </svg>
      </div>

      {/* Top Row Spacer & Full Screen Toggle Button */}
      <div className="relative z-10 flex w-full max-w-4xl shrink-0 items-center justify-end">
        <button
          type="button"
          onClick={() => {
            soundEngine.unlock();
            soundEngine.playMenuClick();
            onToggleFullscreen();
          }}
          aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          className="flex min-h-[38px] sm:min-h-[40px] items-center gap-2 rounded-xl border border-[#d4af37]/40 bg-[#1a120e]/95 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#f7da84] shadow-lg hover:border-[#f3d06b]/70 hover:bg-[#261a14] active:scale-[0.98] transition-all whitespace-nowrap"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4 text-[#f3d06b]" />
          ) : (
            <Maximize2 className="h-4 w-4 text-[#f3d06b]" />
          )}
          <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
        </button>
      </div>

      {/* Main 2-column landscape showcase */}
      <div className="my-auto grid w-full max-w-4xl grid-cols-12 items-center gap-4 sm:gap-7">
        {/* Left: 1990s Casino Billiards Club Plaque with Custom Rack Dashboard Icon */}
        <div className="mahogany-panel relative col-span-7 flex flex-col justify-between rounded-2xl border border-[#d4af37]/40 p-4 sm:p-6">
          <BrassCorners size={18} />

          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Custom Dashboard Icon (/assets/aistudio/image_8006b8e7.png) framed in brass */}
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[#d4af37]/75 bg-[#fcfaf5] p-1 shadow-[0_8px_18px_rgba(0,0,0,0.65)]">
              {!iconLoadError ? (
                <img
                  src="/assets/aistudio/image_8006b8e7.png"
                  alt="Grand Regency 8-Ball Billiard Rack Icon"
                  referrerPolicy="no-referrer"
                  onError={() => setIconLoadError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-casino text-lg font-extrabold text-[#15181c]">8</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-[#d4af37] uppercase">
                <span>Grand Regency Club</span>
                <span aria-hidden="true">·</span>
                <span>Est. 1994</span>
              </div>

              <h1 className="font-casino mt-1 text-xl sm:text-3xl font-extrabold tracking-wide leading-[1.12]">
                <span className="text-[#faf4e6]">Grand Regency </span>
                <span className="gold-title-gradient block">8-Ball Pool</span>
              </h1>
            </div>
          </div>

          {/* Miniature Top-Down Mahogany & Brass Pool Table Diorama */}
          <div className="relative mt-3 sm:mt-4 rounded-xl border-2 border-[#5b2d18] bg-[#2f150a] p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(243,208,107,0.3)]">
            <div className="relative overflow-hidden rounded-lg border border-[#d4af37]/35 bg-[#0a4c32] px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-[inset_0_2px_14px_rgba(0,0,0,0.72)]">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 30% 50%, rgba(255,235,175,0.14) 0%, transparent 62%)',
                }}
              />
              <div className="relative flex items-center gap-3.5">
                <svg
                  viewBox="0 0 112 64"
                  className="h-11 w-20 sm:h-13 sm:w-24 shrink-0 drop-shadow-[0_4px_7px_rgba(0,0,0,0.55)]"
                  aria-hidden="true"
                >
                  <line x1="2" y1="36" x2="24" y2="33" stroke="#d4af37" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="2" y1="36" x2="14" y2="34.4" stroke="#4e2212" strokeWidth="3.2" strokeLinecap="round" />
                  <line x1="23" y1="33.1" x2="25.5" y2="32.8" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" />
                  <circle cx="34" cy="32" r="8.5" fill="#FAF6E8" stroke="#111" strokeWidth="0.8" />
                  <circle cx="31.5" cy="29.5" r="2.6" fill="rgba(255,255,255,0.7)" />
                  <circle cx="62" cy="32" r="8" fill="#EAB308" stroke="#111" strokeWidth="0.8" />
                  <circle cx="62" cy="32" r="3.6" fill="#FCF8EC" />
                  <text x="62" y="34.2" textAnchor="middle" fontSize="5.8" fontWeight="800" fill="#111">1</text>
                  <circle cx="76" cy="23" r="8" fill="#FAF6E8" stroke="#111" strokeWidth="0.8" />
                  <rect x="68.5" y="19" width="15" height="8" rx="1.8" fill="#DC2626" />
                  <circle cx="76" cy="23" r="3.6" fill="#FCF8EC" />
                  <text x="76" y="25.2" textAnchor="middle" fontSize="5.8" fontWeight="800" fill="#111">11</text>
                  <circle cx="76" cy="41" r="8" fill="#1D4ED8" stroke="#111" strokeWidth="0.8" />
                  <circle cx="76" cy="41" r="3.6" fill="#FCF8EC" />
                  <text x="76" y="43.2" textAnchor="middle" fontSize="5.8" fontWeight="800" fill="#111">2</text>
                  <circle cx="90" cy="14" r="8" fill="#15803D" stroke="#111" strokeWidth="0.8" />
                  <circle cx="90" cy="14" r="3.6" fill="#FCF8EC" />
                  <text x="90" y="16.2" textAnchor="middle" fontSize="5.8" fontWeight="800" fill="#111">6</text>
                  <circle cx="90" cy="32" r="8" fill="#15181C" stroke="#000" strokeWidth="0.8" />
                  <circle cx="90" cy="32" r="3.8" fill="#FCF8EC" />
                  <text x="90" y="34.2" textAnchor="middle" fontSize="6" fontWeight="800" fill="#111">8</text>
                  <circle cx="90" cy="50" r="8" fill="#FAF6E8" stroke="#111" strokeWidth="0.8" />
                  <rect x="82.5" y="46" width="15" height="8" rx="1.8" fill="#EA580C" />
                  <circle cx="90" cy="50" r="3.6" fill="#FCF8EC" />
                  <text x="90" y="52.2" textAnchor="middle" fontSize="5.8" fontWeight="800" fill="#111">13</text>
                </svg>

                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#faf4e6]">
                    Championship 2D Billiards Hall
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-[#cde3d7]">
                    <span>WPA 8-Ball Rules</span>
                    <span aria-hidden="true">·</span>
                    <span>Private Rooms</span>
                    <span aria-hidden="true">·</span>
                    <span>Offline Bot AI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="brass-divider mt-2.5 mb-2" />

          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#b0a594]">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-red-500'
                }`}
              />
              <span>
                {connectionStatus === 'connected'
                  ? 'Online server ready'
                  : connectionStatus === 'reconnecting'
                  ? 'Reconnecting (Bot mode ready offline)'
                  : 'Offline Bot ready · Connecting online...'}
              </span>
            </div>
            <span className="hidden sm:inline text-[11px] text-[#8f8474]">Landscape Parlor</span>
          </div>
        </div>

        {/* Right: Primary Casino Parlor Menu Buttons */}
        <div className="col-span-5 flex flex-col justify-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playMenuClick();
              onPlayOnline();
            }}
            className="flex min-h-[46px] sm:min-h-[50px] items-center justify-center gap-2.5 rounded-xl border border-[#f3d06b]/65 bg-gradient-to-b from-[#11734d] via-[#0b5438] to-[#083c28] px-4 py-2 font-casino text-sm sm:text-base font-bold tracking-wider text-[#f7da84] shadow-[0_10px_24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.16)] hover:from-[#148458] hover:to-[#0a4931] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>ONLINE MULTIPLAYER</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playMenuClick();
              onPlayBot();
            }}
            className="flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2.5 rounded-xl border border-[#f3d06b]/50 bg-gradient-to-b from-[#5d331d] via-[#412112] to-[#2a140a] px-4 py-2 font-casino text-sm sm:text-base font-bold tracking-wider text-[#f7da84] shadow-[0_8px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)] hover:from-[#6d3c23] hover:to-[#35190d] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-[#f3d06b]" />
            <span>VS BOT (OFFLINE)</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playMenuClick();
                onOpenSettings();
              }}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#d4af37]/30 bg-gradient-to-b from-[#211712] to-[#150e0b] px-3 py-2 text-xs sm:text-sm font-semibold tracking-wide text-[#f5efe2] shadow-md hover:border-[#f3d06b]/55 hover:from-[#2a1d17] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <Settings className="h-4 w-4 text-[#d4af37]" />
              <span>SETTINGS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playMenuClick();
                onOpenRuleBook();
              }}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#d4af37]/30 bg-gradient-to-b from-[#211712] to-[#150e0b] px-3 py-2 text-xs sm:text-sm font-semibold tracking-wide text-[#f5efe2] shadow-md hover:border-[#f3d06b]/55 hover:from-[#2a1d17] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4 text-[#d4af37]" />
              <span>RULE BOOK</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playMenuClick();
              onOpenAbout();
            }}
            className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[#d4af37]/30 bg-gradient-to-b from-[#211712] to-[#150e0b] px-4 py-2 text-xs sm:text-sm font-semibold tracking-wide text-[#f5efe2] shadow-md hover:border-[#f3d06b]/55 hover:from-[#2a1d17] active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Info className="h-4 w-4 text-[#d4af37]" />
            <span>ABOUT</span>
          </button>
        </div>
      </div>

      {/* Studio Attribution Footer */}
      <footer className="shrink-0 text-center text-[11px] sm:text-xs font-medium tracking-[0.16em] text-[#c7b897]">
        <span>Developed by </span>
        <span className="font-casino font-bold text-[#f3d06b]">PRAKALP STUDIOS</span>
      </footer>
    </div>
  );
};
