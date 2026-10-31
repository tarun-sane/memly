import React, { useState } from 'react';
import { VisualStudyType } from '../types/memory';

interface VisualStudyArtworkProps {
  study: VisualStudyType;
  customImageUrl?: string;
  title: string;
  indexCode: string;
  className?: string;
}

export const VisualStudyArtwork: React.FC<VisualStudyArtworkProps> = ({
  study,
  customImageUrl,
  title,
  indexCode,
  className = 'h-48',
}) => {
  const [imgError, setImgError] = useState(false);

  if (customImageUrl && !imgError) {
    return (
      <div className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${className}`}>
        <img
          src={customImageUrl}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#74A57F]/60 via-transparent to-transparent pointer-events-none" />
        <span className="absolute bottom-3 left-3.5 font-mono text-[11px] tracking-wider text-white/95 tabular-nums">
          {indexCode}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#74A57F]/10 dark:bg-zinc-900/90 border-b border-zinc-200/80 dark:border-zinc-800/80 select-none ${className}`}
    >
      {study === 'pavilion' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F] dark:text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Architectural elevation & rain study */}
          <line x1="0" y1="185" x2="400" y2="185" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
          <line x1="40" y1="75" x2="360" y2="75" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
          <line x1="24" y1="83" x2="376" y2="83" stroke="#B58ACE" strokeOpacity="0.55" strokeWidth="1" />
          {/* Timber columns */}
          <line x1="85" y1="83" x2="85" y2="185" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" />
          <line x1="195" y1="83" x2="195" y2="185" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" />
          <line x1="305" y1="83" x2="305" y2="185" stroke="currentColor" strokeOpacity="0.65" strokeWidth="2" />
          {/* Diagonal rain acoustic vectors */}
          <g stroke="#B58ACE" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5">
            <line x1="70" y1="20" x2="50" y2="180" />
            <line x1="120" y1="15" x2="100" y2="180" />
            <line x1="170" y1="25" x2="150" y2="180" />
            <line x1="230" y1="15" x2="210" y2="180" />
            <line x1="280" y1="25" x2="260" y2="180" />
            <line x1="340" y1="20" x2="320" y2="180" />
          </g>
          {/* Pond water ripples */}
          <ellipse cx="145" cy="215" rx="68" ry="11" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
          <ellipse cx="145" cy="215" rx="34" ry="5" stroke="#B58ACE" strokeOpacity="0.6" strokeWidth="1" />
          <ellipse cx="275" cy="225" rx="48" ry="8" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
        </svg>
      )}

      {study === 'observatory' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Zenithal Oculus & Light Cone */}
          <circle cx="200" cy="115" r="64" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.25" />
          <circle cx="200" cy="115" r="42" stroke="#B58ACE" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="2 3" />
          <path
            d="M136 115 L70 250 L330 250 L264 115"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          {/* Alpine ridge horizon */}
          <path
            d="M0 190 L95 142 L175 174 L265 128 L350 168 L400 148"
            stroke="#B58ACE"
            strokeOpacity="0.6"
            strokeWidth="1.2"
          />
          <line x1="200" y1="25" x2="200" y2="235" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
          <line x1="60" y1="115" x2="340" y2="115" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
        </svg>
      )}

      {study === 'ceramics' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Stoneware vessel profile & throwing rings */}
          <path
            d="M140 70 C132 135, 148 188, 172 205 L228 205 C252 188, 268 135, 260 70 Z"
            stroke="currentColor"
            strokeOpacity="0.65"
            strokeWidth="1.4"
          />
          <ellipse cx="200" cy="70" rx="60" ry="10" stroke="#B58ACE" strokeOpacity="0.65" strokeWidth="1.2" />
          <ellipse cx="200" cy="115" rx="61" ry="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 3" />
          <ellipse cx="200" cy="155" rx="54" ry="8" stroke="#B58ACE" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="40" y1="205" x2="360" y2="205" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
        </svg>
      )}

      {study === 'botanical' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Archival herbarium frame */}
          <rect
            x="48"
            y="24"
            width="304"
            height="212"
            stroke="#B58ACE"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          {/* Ginkgo biloba fan leaf study */}
          <path
            d="M200 205 Q200 160 200 142 C165 136 130 105 135 68 C158 62 186 72 197 96 C200 102 202 102 205 96 C216 72 244 62 265 68 C270 105 235 136 200 142"
            stroke="currentColor"
            strokeOpacity="0.7"
            strokeWidth="1.4"
          />
          {/* Bifurcated venation lines */}
          <path d="M200 142 L156 82" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
          <path d="M200 142 L176 78" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
          <path d="M200 142 L224 78" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
          <path d="M200 142 L244 82" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
        </svg>
      )}

      {study === 'acoustics' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Chladni nodal plate geometry */}
          <rect x="110" y="40" width="180" height="180" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
          <circle cx="200" cy="130" r="68" stroke="#B58ACE" strokeOpacity="0.55" strokeWidth="1" />
          <circle cx="200" cy="130" r="32" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
          <path d="M110 40 Q200 130 290 40" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
          <path d="M110 220 Q200 130 290 220" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
          <path d="M110 40 Q200 130 110 220" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
          <path d="M290 40 Q200 130 290 220" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" />
        </svg>
      )}

      {study === 'typography' && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Swiss modular proportion grid & golden ratio canon */}
          <g stroke="currentColor" strokeOpacity="0.32" strokeWidth="1">
            <rect x="44" y="30" width="148" height="200" />
            <rect x="208" y="30" width="148" height="200" />
            <line x1="44" y1="86" x2="356" y2="86" />
            <line x1="44" y1="154" x2="356" y2="154" />
            <line x1="44" y1="30" x2="192" y2="230" stroke="#B58ACE" strokeDasharray="3 3" />
          </g>
          <circle cx="282" cy="120" r="44" stroke="#B58ACE" strokeOpacity="0.65" strokeWidth="1.4" />
          <line x1="282" y1="120" x2="282" y2="82" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.6" />
          <circle cx="282" cy="82" r="3.5" fill="#B58ACE" />
        </svg>
      )}

      {(study === 'horizon' || study === 'none') && (
        <svg
          viewBox="0 0 400 260"
          className="w-full h-full object-cover text-[#74A57F]"
          fill="none"
        >
          <rect width="400" height="260" className="fill-[#74A57F]/10 dark:fill-zinc-900" />
          {/* Topographic contour strata & fog advection */}
          <path d="M0 110 Q110 85 210 112 T400 95" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
          <path d="M0 135 Q120 108 220 136 T400 122" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.1" />
          <path d="M0 160 Q130 132 230 162 T400 148" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.2" />
          <path d="M0 185 Q140 158 240 188 T400 175" stroke="#B58ACE" strokeOpacity="0.45" strokeWidth="1" />
          <circle cx="295" cy="68" r="18" stroke="#B58ACE" strokeOpacity="0.6" strokeWidth="1.2" />
        </svg>
      )}

      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
        <span className="font-mono text-[11px] tracking-wider text-[#456b4e] dark:text-[#98c9a3] tabular-nums">
          {indexCode}
        </span>
        <span className="font-mono text-[11px] text-[#74A57F] dark:text-[#B58ACE]">
          Fig. {study === 'none' ? 'archive' : study}
        </span>
      </div>
    </div>
  );
};
