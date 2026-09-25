import React from 'react';

interface BayShieldLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  animatePulse?: boolean;
}

export const BayShieldLogo: React.FC<BayShieldLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  animatePulse = true,
}) => {
  // Dimensions based on size
  const iconDimensions = {
    sm: { w: 24, h: 24, textClass: 'text-xs' },
    md: { w: 32, h: 32, textClass: 'text-sm' },
    lg: { w: 42, h: 42, textClass: 'text-base' },
    xl: { w: 56, h: 56, textClass: 'text-xl' },
  }[size];

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Precision Vector Emblem */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: iconDimensions.w, height: iconDimensions.h }}
      >
        {/* Ambient Backlight Glow */}
        <div
          className={`absolute inset-0 rounded-xl bg-gradient-to-tr from-cyan-500/30 via-sky-500/20 to-blue-600/30 blur-md ${
            animatePulse ? 'animate-pulse' : ''
          }`}
        />

        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
        >
          <defs>
            {/* Primary Shield Gradient */}
            <linearGradient id="shieldBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Shield Interior Gradient */}
            <linearGradient id="shieldInteriorGrad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="60%" stopColor="#020617" />
              <stop offset="100%" stopColor="#082f49" />
            </linearGradient>

            {/* Cyclone Wave Vortex Gradient 1 */}
            <linearGradient id="cycloneArm1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            {/* Cyclone Wave Vortex Gradient 2 */}
            <linearGradient id="cycloneArm2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Center Core Glow */}
            <radialGradient id="eyeCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#38bdf8" />
              <stop offset="80%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1. Outer Hexagonal Shield Shell */}
          <path
            d="M50 8 L86 24 C86 54 72 78 50 92 C28 78 14 54 14 24 Z"
            fill="url(#shieldInteriorGrad)"
            stroke="url(#shieldBorderGrad)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* 2. Inner Shield Precision Inset Contour */}
          <path
            d="M50 14 L80 28 C80 52 68 72 50 84 C32 72 20 52 20 28 Z"
            stroke="#0ea5e9"
            strokeWidth="1"
            strokeDasharray="2.5 2.5"
            strokeOpacity="0.5"
            fill="none"
          />

          {/* 3. Oceanic Bathymetric Depth Wave / Shelf Crest */}
          <path
            d="M24 46 C32 40 40 48 50 44 C60 40 68 48 76 44 C78 52 76 60 72 67 C64 74 58 78 50 82 C42 78 36 74 28 67 C24 60 22 52 24 46 Z"
            fill="#0369a1"
            fillOpacity="0.25"
          />

          {/* 4. Cyclone Vortex Arm A (Clockwise Swirl) */}
          <path
            d="M50 32 C62 32 70 40 68 52 C66 60 58 66 48 66 C40 66 34 60 36 50 C38 42 46 38 52 40 C56 42 58 46 56 50 C54 53 50 54 48 52"
            stroke="url(#cycloneArm1)"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* 5. Cyclone Vortex Arm B (Opposing Counter-Current Arm) */}
          <path
            d="M50 68 C38 68 30 60 32 48 C34 40 42 34 52 34 C60 34 66 40 64 50 C62 58 54 62 48 60"
            stroke="url(#cycloneArm2)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="18 4"
            fill="none"
          />

          {/* 6. Orbital Satellite Radar Sweep Arc */}
          <path
            d="M32 26 C42 22 58 22 68 26"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
          <path
            d="M26 36 C34 30 66 30 74 36"
            stroke="#22d3ee"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            strokeOpacity="0.6"
          />

          {/* 7. Cyclone Eye Center Beacon */}
          <circle cx="50" cy="50" r="5" fill="url(#eyeCoreGlow)" />
          <circle cx="50" cy="50" r="2.2" fill="#0f172a" />
          <circle cx="50" cy="50" r="1.2" fill="#38bdf8" />

          {/* 8. AI Neural Telemetry Nodes */}
          <circle cx="50" cy="14" r="2" fill="#38bdf8" />
          <circle cx="80" cy="28" r="1.8" fill="#22d3ee" />
          <circle cx="20" cy="28" r="1.8" fill="#22d3ee" />
          <circle cx="50" cy="84" r="2" fill="#0284c7" />
        </svg>
      </div>

      {/* Brand Typographic Wordmark (Optional) */}
      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-extrabold tracking-tight text-slate-100 ${iconDimensions.textClass}`}>
              Bay<span className="text-cyan-400">Shield</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
              AI
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-normal mt-0.5">
            Cyclone Defense System
          </span>
        </div>
      )}
    </div>
  );
};
