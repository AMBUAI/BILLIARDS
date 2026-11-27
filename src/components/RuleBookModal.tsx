import React, { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { RULE_BOOK_SECTIONS } from '../shared/rulebook.ts';
import { soundEngine } from '../audio/soundEngine.ts';
import { BrassCorners } from './BrassCorners.tsx';

interface RuleBookModalProps {
  onClose: () => void;
}

export const RuleBookModal: React.FC<RuleBookModalProps> = ({ onClose }) => {
  const [activeId, setActiveId] = useState<number>(1);

  const activeSection =
    RULE_BOOK_SECTIONS.find((s) => s.id === activeId) ?? RULE_BOOK_SECTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 backdrop-blur-sm">
      <div className="mahogany-panel relative flex h-full max-h-[540px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#d4af37]/45">
        <BrassCorners size={18} />
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#d4af37]/25 bg-[#1a120e] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-[#d4af37]" />
            <h2 className="font-casino gold-title-gradient text-lg font-bold tracking-wide">
              Official 8-Ball Rule Book
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuClick();
              onClose();
            }}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-[#d4af37]/25 bg-[#231813] text-[#e6decb] hover:border-[#f3d06b]/55 hover:bg-[#2f211a]"
            aria-label="Close rule book"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Two-column landscape reading layout */}
        <div className="flex min-h-0 flex-1">
          <nav className="casino-scroll w-56 shrink-0 overflow-y-auto border-r border-[#d4af37]/20 bg-[#0d0a08] p-2.5">
            <div className="space-y-1">
              {RULE_BOOK_SECTIONS.map((sec) => {
                const active = sec.id === activeId;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playMenuClick();
                      setActiveId(sec.id);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#0b4f35] text-[#f7da84] border border-[#d4af37]/45 shadow-sm'
                        : 'text-[#c8bfae] hover:bg-[#1e1510] hover:text-[#faf4e6]'
                    }`}
                  >
                    {sec.title}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="casino-scroll flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold tracking-wider text-[#d4af37] uppercase">
                WPA-Style Match Rules · Section {activeSection.id} of {RULE_BOOK_SECTIONS.length}
              </div>
              <h3 className="font-casino mt-1 text-xl font-bold text-[#faf4e6]">
                {activeSection.title}
              </h3>

              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#dfd7c8]">
                {activeSection.body.map((para, idx) => (
                  <p key={idx} className={para.startsWith('•') ? 'pl-3 text-[#f2ebd9]' : ''}>
                    {para}
                  </p>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#d4af37]/15 pt-4">
                <button
                  type="button"
                  disabled={activeId <= 1}
                  onClick={() => {
                    soundEngine.playMenuClick();
                    setActiveId((prev) => Math.max(1, prev - 1));
                  }}
                  className="min-h-[40px] rounded-xl border border-[#d4af37]/30 px-4 py-2 text-xs font-semibold text-[#e8decb] disabled:opacity-35 hover:bg-[#231813]"
                >
                  Previous Section
                </button>
                <button
                  type="button"
                  disabled={activeId >= RULE_BOOK_SECTIONS.length}
                  onClick={() => {
                    soundEngine.playMenuClick();
                    setActiveId((prev) => Math.min(RULE_BOOK_SECTIONS.length, prev + 1));
                  }}
                  className="min-h-[40px] rounded-xl bg-gradient-to-b from-[#11734d] to-[#08422b] border border-[#f3d06b]/45 px-4 py-2 text-xs font-semibold text-[#f7da84] disabled:opacity-35 hover:from-[#148458]"
                >
                  Next Section
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
