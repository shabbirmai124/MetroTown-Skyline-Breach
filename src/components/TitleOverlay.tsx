// Created by Md Shabbir Mia
import React from 'react';
import { ROUND_CONFIGS } from '../game/rules';
import { StageId } from '../game/types';

interface TitleOverlayProps {
  onStart: () => void;
  bestScore: number;
  selectedStage: StageId;
  onSelectStage: (stage: StageId) => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  onStart,
  bestScore,
  selectedStage,
  onSelectStage,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-14 pointer-events-none">
      {/* Subtle dark vignette scrim on left third so title lockup stays razor legible over live 3D tour */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,9,14,0.9) 0%, rgba(6,9,14,0.5) 42%, rgba(6,9,14,0.12) 100%)',
        }}
      />

      {/* Top minimal station marker */}
      <div className="relative z-10 flex items-center justify-between text-xs tracking-widest uppercase text-slate-300/85 font-mono-num">
        <span>MetroTown: Skyline Breach · 4-Sector Tactical Campaign</span>
        {bestScore > 0 && <span>Best Score · {bestScore.toLocaleString()}</span>}
      </div>

      {/* Main focal lockup anchored over left-third negative space */}
      <div className="relative z-10 max-w-xl my-auto">
        <svg
          viewBox="0 0 600 168"
          className="w-full max-w-[540px] h-auto mb-5 drop-shadow-[0_10px_24px_rgba(0,0,0,0.8)]"
          role="img"
          aria-label="MetroTown: Skyline Breach"
        >
          <rect
            x="2"
            y="2"
            width="596"
            height="164"
            rx="6"
            fill="#0c1017"
            stroke="#364152"
            strokeWidth="2.5"
          />
          <rect x="2" y="2" width="596" height="14" rx="2" fill="#e69f19" />
          {/* Metro + Town Building Silhouette Crest */}
          <rect x="24" y="42" width="12" height="62" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <rect x="38" y="30" width="16" height="74" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
          <rect x="56" y="48" width="12" height="56" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <circle cx="46" cy="96" r="20" fill="#1d4ed8" stroke="#f8fafc" strokeWidth="2.2" />
          <text
            x="46"
            y="104"
            textAnchor="middle"
            fill="#f8fafc"
            fontSize="22"
            fontWeight="700"
            fontFamily="Chakra Petch, sans-serif"
          >
            MT
          </text>
          <text
            x="88"
            y="76"
            fill="#f8fafc"
            fontSize="46"
            fontWeight="700"
            letterSpacing="2"
            fontFamily="Chakra Petch, sans-serif"
          >
            METROTOWN
          </text>
          <text
            x="88"
            y="104"
            fill="#f59e0b"
            fontSize="21"
            fontWeight="700"
            letterSpacing="4.5"
            fontFamily="Chakra Petch, sans-serif"
          >
            SKYLINE BREACH
          </text>
          <rect x="88" y="114" width="484" height="2" fill="#334155" />
          <text
            x="88"
            y="138"
            fill="#cbd5e1"
            fontSize="13.5"
            fontWeight="600"
            letterSpacing="2.4"
            fontFamily="JetBrains Mono, monospace"
          >
            SUBWAY RAILS · TOWN BOULEVARD · SKYLINE TOWER
          </text>
        </svg>

        {/* Compact 4-Sector Deployment Selector */}
        <div className="mb-5 pointer-events-auto">
          <div className="text-[11px] font-mono-num uppercase tracking-widest text-slate-400 mb-2">
            Deployment Sector
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-[500px]">
            {ROUND_CONFIGS.map((cfg) => {
              const active = selectedStage === cfg.round;
              return (
                <button
                  key={cfg.round}
                  type="button"
                  onClick={() => onSelectStage(cfg.round)}
                  className={`px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[rgba(230,159,25,0.22)] border-amber-400 text-amber-200'
                      : 'bg-[rgba(12,16,22,0.82)] border-slate-700/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-mono-num text-amber-400">0{cfg.round}</div>
                  <div className="text-xs font-display font-bold leading-tight whitespace-nowrap">
                    {cfg.stageName}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="px-8 py-4 rounded bg-[#e69f19] hover:bg-[#f2b338] active:scale-[0.98] text-neutral-950 font-display font-bold text-lg tracking-wider uppercase transition-transform duration-150 shadow-[0_8px_24px_rgba(230,159,25,0.35)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Deploy Now
          </button>
          <span className="text-xs font-mono-num text-slate-300/85 tracking-wide">
            Press Enter or Space
          </span>
        </div>
      </div>

      {/* Single flat borderless control-hint line */}
      <div className="relative z-10 text-xs sm:text-sm text-slate-300/85 font-mono-num tracking-wide hud-text-shadow">
        WASD Move · Shift Sprint · Mouse Aim · LMB/F Fire · RMB/V ADS · Z Zoom · G Frag · 1-7 Guns · R Reload · E Extract · P Settings
      </div>
    </div>
  );
};
