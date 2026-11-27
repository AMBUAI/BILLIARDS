import React from 'react';

const BALL_HEX: Record<number, string> = {
  1: '#EAB308',
  2: '#1D4ED8',
  3: '#DC2626',
  4: '#7E22CE',
  5: '#EA580C',
  6: '#15803D',
  7: '#881337',
  8: '#15181C',
  9: '#EAB308',
  10: '#1D4ED8',
  11: '#DC2626',
  12: '#7E22CE',
  13: '#EA580C',
  14: '#15803D',
  15: '#881337',
};

interface BallBadgeProps {
  id: number;
  pocketed?: boolean;
  size?: number;
}

export const BallBadge: React.FC<BallBadgeProps> = ({
  id,
  pocketed = false,
  size = 18,
}) => {
  const color = BALL_HEX[id] || '#FAF7EE';
  const isStripe = id >= 9 && id <= 15;

  return (
    <span
      title={`Ball ${id}`}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-black/50 shadow-sm transition-opacity ${
        pocketed ? 'opacity-20 grayscale' : 'opacity-100'
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: isStripe ? '#FAF7EE' : color,
        overflow: 'hidden',
      }}
    >
      {isStripe && (
        <span
          className="absolute inset-x-0"
          style={{
            top: '22%',
            bottom: '22%',
            backgroundColor: color,
          }}
        />
      )}
      <span
        className="relative z-10 flex items-center justify-center rounded-full bg-[#fcf9f0] font-bold text-[#111315] leading-none"
        style={{
          width: size * 0.52,
          height: size * 0.52,
          fontSize: Math.max(7, Math.round(size * 0.42)),
        }}
      >
        {id}
      </span>
    </span>
  );
};
