import React, { useId } from 'react';
import { getProcedureGradient } from '../utils/format';

export const BrandMark: React.FC<{ width?: number; className?: string }> = ({
  width = 34,
  className = '',
}) => {
  const gradId = useId();
  const height = Math.round(width * 1.22);
  return (
    <svg
      viewBox="0 0 100 122"
      width={width}
      height={height}
      role="img"
      aria-label="Diadikasia logo"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a5fb0" />
          <stop offset="1" stopColor="#17aeb6" />
        </linearGradient>
      </defs>
      <path
        d="M50 3L94 14V60C94 90 72 106 50 117C28 106 6 90 6 60V14Z"
        fill={`url(#${gradId})`}
      />
      <path d="M52 14h10v9h9v10h-9v9H52v-9h-9V23h9z" fill="#fff" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M26 44V58C26 68 33 74 41 74" />
        <path d="M44 44V54C44 61 42 67 39 71" />
        <path d="M41 74C54 86 74 82 80 69" />
        <path d="M58 76C49 70 43 65 43 59C43 55 46 52 50 52C54 52 57 54 58 57C59 54 62 52 66 52C70 52 73 55 73 59C73 65 67 70 58 76Z" />
        <circle cx="83" cy="63" r="5" />
      </g>
    </svg>
  );
};

export const BrandWordmark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <span
    className="font-display font-extrabold tracking-tight whitespace-nowrap shrink-0"
    style={{ fontSize: `${size}px` }}
  >
    <span style={{ color: '#1d62ad' }}>Diadik</span>
    <span style={{ color: '#17a2b0' }}>asia</span>
  </span>
);

function getCategoryMotif(category: string): React.ReactNode {
  const c = category.toLowerCase();
  if (c.includes('iv')) {
    return (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.24">
        <rect x="28" y="18" width="24" height="40" rx="5" />
        <path d="M40 58v26c0 8 10 12 22 12h42" />
        <path d="M35 32h10M40 27v10" />
        <circle cx="110" cy="96" r="6" />
      </g>
    );
  }
  if (c.includes('wound') || c.includes('sutur') || c.includes('general')) {
    return (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.24">
        <path d="M22 65c28-18 68-18 96 0" />
        <path d="M38 50v22M54 46v24M70 45v24M86 46v24M102 50v22" />
      </g>
    );
  }
  if (c.includes('cardio') || c.includes('emergency') || c.includes('fund')) {
    return (
      <g stroke="currentColor" strokeWidth="1.8" fill="none" opacity="0.26">
        <path d="M12 64h26l8-20 10 40 12-48 10 34 8-6h42" strokeLinejoin="round" />
      </g>
    );
  }
  if (c.includes('ortho')) {
    return (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.24">
        <path d="M44 20c-4 0-7 3-7 7s3 7 7 7v48c-4 0-7 3-7 7s3 7 7 7h12c4 0 7-3 7-7s-3-7-7-7V34c4 0 7-3 7-7s-3-7-7-7H44z" />
        <path d="M34 52h32M34 64h32" strokeDasharray="3 3" />
      </g>
    );
  }
  return (
    <g stroke="currentColor" strokeWidth="1.6" fill="none" opacity="0.22">
      <circle cx="70" cy="58" r="34" />
      <path d="M70 42v32M54 58h32" />
    </g>
  );
}

export const ProcedureThumbnail: React.FC<{
  hue: number;
  category: string;
  duration: string;
  heightClass?: string;
}> = ({ hue, category, duration, heightClass = 'h-36' }) => {
  return (
    <div
      className={`relative w-full ${heightClass} overflow-hidden flex items-center justify-center text-white`}
      style={{ background: getProcedureGradient(hue) }}
    >
      {/* Subtle clinical grid overlay */}
      <svg
        className="absolute inset-0 w-full h-full text-white pointer-events-none"
        viewBox="0 0 140 116"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={`grid-${hue}`}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.09"
            />
          </pattern>
        </defs>
        <rect width="140" height="116" fill={`url(#grid-${hue})`} />
        {getCategoryMotif(category)}
      </svg>

      {/* Measured contrast scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />

      {/* Center play icon */}
      <div className="relative z-10 w-11 h-11 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-sm transition-transform duration-150 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="w-5 h-5 ml-0.5 fill-current" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>

      {/* Category label & duration */}
      <span className="absolute top-3 left-3 z-10 text-[11px] font-semibold tracking-wide text-white/95 bg-slate-950/70 backdrop-blur-xs px-2.5 py-0.5 rounded-md">
        {category}
      </span>
      <span className="absolute bottom-3 right-3 z-10 text-[11px] font-mono tabular-nums font-medium text-white bg-slate-950/75 px-2 py-0.5 rounded-md">
        {duration}
      </span>
    </div>
  );
};
