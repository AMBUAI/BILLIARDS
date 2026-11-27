import React from 'react';

interface BrassCornersProps {
  size?: number;
}

export const BrassCorners: React.FC<BrassCornersProps> = ({ size = 16 }) => {
  const bracket = (posClass: string, transform: string) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`pointer-events-none absolute ${posClass}`}
      style={{ transform }}
    >
      <path
        d="M2 18 L2 4 Q2 2 4 2 L18 2"
        fill="none"
        stroke="rgba(243, 208, 107, 0.65)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 14 L5.5 6.5 Q5.5 5.5 6.5 5.5 L14 5.5"
        fill="none"
        stroke="rgba(212, 175, 55, 0.35)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="3.8" cy="3.8" r="1.2" fill="#f7da84" />
    </svg>
  );

  return (
    <>
      {bracket('left-1.5 top-1.5', 'none')}
      {bracket('right-1.5 top-1.5', 'scaleX(-1)')}
      {bracket('left-1.5 bottom-1.5', 'scaleY(-1)')}
      {bracket('right-1.5 bottom-1.5', 'scale(-1, -1)')}
    </>
  );
};
