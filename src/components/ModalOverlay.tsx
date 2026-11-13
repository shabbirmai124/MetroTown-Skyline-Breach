// Created by Md Shabbir Mia
import React from 'react';
import { AimSettings, CrosshairColor, HudSnapshot } from '../game/types';

interface ModalOverlayProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onUpdateAimSettings: (partial: Partial<AimSettings>) => void;
}

const CROSSHAIR_OPTIONS: { id: CrosshairColor; label: string; swatch: string }[] = [
  { id: 'cyan', label: 'Cyan', swatch: '#22d3ee' },
  { id: 'green', label: 'Green', swatch: '#4ade80' },
  { id: 'amber', label: 'Amber', swatch: '#fbbf24' },
  { id: 'white', label: 'White', swatch: '#f8fafc' },
];

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  hud,
  onResume,
  onRestart,
  onTitle,
  onUpdateAimSettings,
}) => {
  const isPaused = hud.phase === 'paused';
  const isVictory = hud.phase === 'gameover' && hud.victory;

  const title = isPaused
    ? 'Tactical Pause & Aim Settings'
    : isVictory
      ? 'Skyline Extraction Complete'
      : `Overrun in ${hud.stageName}`;

  const subtitle = isPaused
    ? `Stage ${hud.round}/${hud.totalRounds} · ${hud.stageName} (${hud.roundTitle})`
    : isVictory
      ? 'Cleared Metro Station, Town Boulevard, Meridian Tower, and Skyline Helipad.'
      : `Fell during Stage ${hud.round} · ${hud.stageName}.`;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[rgba(5,7,11,0.78)]">
      <div className="w-full max-w-lg rounded-md bg-[#0d1219] border border-slate-700 shadow-2xl overflow-hidden">
        <div
          className={`h-2 w-full ${
            isVictory ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-red-600'
          }`}
        />
        <div className="p-6 sm:p-7">
          <div className="text-xs font-mono-num uppercase tracking-widest text-slate-400 mb-1">
            {isPaused ? 'Tactical Aim Calibration' : isVictory ? 'Mission Complete' : 'Squad Down'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-100 mb-1.5">
            {title}
          </h2>
          <p className="text-sm text-slate-300 mb-5">{subtitle}</p>

          {/* 3 Tabular Stat Tiles */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 rounded bg-[#141b24] border border-slate-800">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Score
              </div>
              <div className="text-xl font-mono-num font-bold text-amber-300">
                {hud.score.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono-num text-slate-500">
                Best {hud.bestScore.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded bg-[#141b24] border border-slate-800">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Kills
              </div>
              <div className="text-xl font-mono-num font-bold text-slate-100">
                {hud.kills}
              </div>
              <div className="text-[10px] font-mono-num text-slate-500">
                Stage {hud.round}/{hud.totalRounds}
              </div>
            </div>

            <div className="p-3 rounded bg-[#141b24] border border-slate-800">
              <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                Breach
              </div>
              <div className="text-xl font-mono-num font-bold text-sky-300">
                {hud.destructionPercent}%
              </div>
              <div className="text-[10px] font-mono-num text-slate-500">
                {hud.destroyedCount}/{hud.totalDestructibleCount} parts
              </div>
            </div>
          </div>

          {/* Tactical Aim & Scope Settings (when paused) */}
          {isPaused && (
            <div className="mb-6 p-4 rounded bg-[#111720] border border-slate-800 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <div className="flex justify-between text-xs font-mono-num text-slate-300 mb-1">
                    <span>Mouse Sensitivity</span>
                    <span className="text-amber-300">{hud.aimSettings.sensitivity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.02"
                    value={hud.aimSettings.sensitivity}
                    onChange={(e) =>
                      onUpdateAimSettings({ sensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-xs font-mono-num text-slate-300 mb-1">
                    <span>ADS / Scope Scale</span>
                    <span className="text-amber-300">{hud.aimSettings.adsMultiplier.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min="0.35"
                    max="1.15"
                    step="0.02"
                    value={hud.aimSettings.adsMultiplier}
                    onChange={(e) =>
                      onUpdateAimSettings({ adsMultiplier: parseFloat(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <label className="block">
                  <div className="flex justify-between text-xs font-mono-num text-slate-300 mb-1">
                    <span>Base FOV</span>
                    <span className="text-amber-300">{Math.round(hud.aimSettings.baseFov)}°</span>
                  </div>
                  <input
                    type="range"
                    min="65"
                    max="92"
                    step="1"
                    value={hud.aimSettings.baseFov}
                    onChange={(e) =>
                      onUpdateAimSettings({ baseFov: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between gap-2 pt-2 sm:pt-0">
                  <span className="text-xs font-mono-num text-slate-300">Smooth Aim Assist</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAimSettings({ smoothAimAssist: !hud.aimSettings.smoothAimAssist })
                    }
                    className={`px-3 py-1 rounded border text-xs font-mono-num font-bold cursor-pointer ${
                      hud.aimSettings.smoothAimAssist
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {hud.aimSettings.smoothAimAssist ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-mono-num text-slate-300">Crosshair Color</span>
                <div className="flex items-center gap-2">
                  {CROSSHAIR_OPTIONS.map((opt) => {
                    const selected = hud.aimSettings.crosshairColor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateAimSettings({ crosshairColor: opt.id })}
                        className={`px-2.5 py-1 rounded border text-[11px] font-mono-num flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? 'bg-slate-800 border-amber-400 text-slate-100'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: opt.swatch }}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                className="flex-1 px-5 py-3 rounded bg-[#e69f19] hover:bg-[#f2b338] text-neutral-950 font-display font-bold uppercase tracking-wider text-sm cursor-pointer"
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={onRestart}
                className="flex-1 px-5 py-3 rounded bg-[#e69f19] hover:bg-[#f2b338] text-neutral-950 font-display font-bold uppercase tracking-wider text-sm cursor-pointer"
              >
                {isVictory ? 'Play Again' : 'Try Again'}
              </button>
            )}

            {isPaused && (
              <button
                type="button"
                onClick={onRestart}
                className="px-4 py-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold uppercase tracking-wider text-sm cursor-pointer"
              >
                Restart
              </button>
            )}

            <button
              type="button"
              onClick={onTitle}
              className="px-4 py-3 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 font-display font-bold uppercase tracking-wider text-sm cursor-pointer"
            >
              Title
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
