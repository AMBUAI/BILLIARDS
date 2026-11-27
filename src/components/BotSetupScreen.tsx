import React, { useState } from 'react';
import { ArrowLeft, Bot, Play, Settings, ShieldCheck } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine.ts';
import type { BotDifficulty } from '../shared/botAi.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface BotSetupScreenProps {
  initialName: string;
  onStartBotMatch: (playerName: string, difficulty: BotDifficulty) => void;
  onBackToMenu: () => void;
  onOpenSettings: () => void;
}

interface DifficultyOption {
  id: BotDifficulty;
  title: string;
  botName: string;
  summary: string;
}

const DIFFICULTIES: DifficultyOption[] = [
  {
    id: 'CASUAL',
    title: 'Casual',
    botName: 'Eddie',
    summary: 'Relaxed aiming with forgiving openings and lighter cut shots.',
  },
  {
    id: 'PRO',
    title: 'Club Pro',
    botName: 'Regency Pro',
    summary: 'Balanced tactical cuts, clean safety hits, and smart ball-in-hand.',
  },
  {
    id: 'MASTER',
    title: 'Shark',
    botName: 'The Shark',
    summary: 'Pinpoint cut angles, scratch-checked shots, and ruthless 8-ball finishes.',
  },
];

export const BotSetupScreen: React.FC<BotSetupScreenProps> = ({
  initialName,
  onStartBotMatch,
  onBackToMenu,
  onOpenSettings,
}) => {
  const [playerName, setPlayerName] = useState<string>(initialName || 'Player 1');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('PRO');

  return (
    <div className="casino-parlor-bg flex h-dvh w-screen flex-col justify-between overflow-hidden px-4 py-3 sm:px-8 sm:py-5">
      {/* Top Bar */}
      <div className="flex shrink-0 items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuClick();
            onBackToMenu();
          }}
          className="flex min-h-[40px] items-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#1a120e] px-3.5 py-2 text-xs font-semibold text-[#f5efe2] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4 text-[#d4af37]" />
          <span>Menu</span>
        </button>

        <h2 className="font-casino gold-title-gradient text-lg sm:text-2xl font-bold tracking-wide">
          Offline Solo vs Bot
        </h2>

        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuClick();
            onOpenSettings();
          }}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/30 bg-[#1a120e] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#251a14] transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 text-[#d4af37]" />
        </button>
      </div>

      {/* Main Setup Card */}
      <div className="mx-auto my-auto w-full max-w-4xl space-y-3">
        {/* Player Name Bar */}
        <div className="mahogany-panel flex items-center gap-3 rounded-xl border border-[#d4af37]/30 px-4 py-2">
          <label
            htmlFor="bot-player-name"
            className="shrink-0 text-xs font-semibold tracking-wider text-[#d4af37] uppercase"
          >
            Your Name
          </label>
          <input
            id="bot-player-name"
            type="text"
            maxLength={16}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your display name"
            className="min-h-[38px] flex-1 rounded-lg border border-[#d4af37]/25 bg-[#0a0c0b] px-3.5 text-sm font-medium text-[#f5efe2] placeholder-[#786f62] focus:border-[#f3d06b] focus:outline-none"
          />
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Works Offline</span>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="grid grid-cols-3 gap-3">
          {DIFFICULTIES.map((opt) => {
            const selected = difficulty === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  soundEngine.playMenuClick();
                  setDifficulty(opt.id);
                }}
                className={`relative flex flex-col justify-between rounded-2xl border p-3.5 sm:p-4 text-left transition-all ${
                  selected
                    ? 'border-[#f3d06b]/85 bg-gradient-to-b from-[#0f6443] to-[#083b27] shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                    : 'mahogany-panel border-[#d4af37]/25 hover:border-[#d4af37]/55'
                }`}
              >
                <BrassCorners size={14} />
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-casino text-sm sm:text-base font-bold text-[#faf4e6]">
                      {opt.title}
                    </span>
                    <Bot
                      className={`h-4 w-4 shrink-0 ${
                        selected ? 'text-[#f7da84]' : 'text-[#d4af37]/75'
                      }`}
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#f3d06b]">
                    {opt.botName}
                  </div>
                  <p className="mt-1.5 text-[11px] sm:text-xs leading-snug text-[#d4ccb9]">
                    {opt.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.unlock();
            soundEngine.playMenuClick();
            onStartBotMatch(playerName.trim() || 'Player 1', difficulty);
          }}
          className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#f3d06b]/65 bg-gradient-to-b from-[#11734d] to-[#08422b] px-5 py-2.5 font-casino text-sm sm:text-base font-bold tracking-wider text-[#f7da84] shadow-lg hover:from-[#148458] hover:to-[#0b5639] active:scale-[0.99] transition-all whitespace-nowrap"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>START VS BOT MATCH</span>
        </button>
      </div>

      <div className="shrink-0 text-center text-[11px] text-[#8d8476]">
        Full WPA 8-Ball rules simulated locally — no internet connection required
      </div>
    </div>
  );
};
