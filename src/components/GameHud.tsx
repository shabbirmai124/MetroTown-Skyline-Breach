// Created by Md Shabbir Mia
import React from 'react';
import { WEAPON_ORDER, WEAPON_SPECS, formatSectorTimer } from '../game/rules';
import { CrosshairColor, HudSnapshot, WeaponId } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onSelectWeapon: (id: WeaponId) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

const CROSSHAIR_HEX: Record<CrosshairColor, string> = {
  cyan: '#22d3ee',
  green: '#4ade80',
  amber: '#fbbf24',
  white: '#f8fafc',
};

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onSelectWeapon,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, (hud.ghostHp / hud.maxHp) * 100));
  const pipsFilled = Math.ceil((hud.hp / hud.maxHp) * 5);
  const activeSpec = WEAPON_SPECS[hud.activeWeapon];
  const activeState = hud.weapons[hud.activeWeapon];
  const reloadProgress =
    activeState.isReloading && activeSpec.reloadDuration > 0
      ? 1 - Math.max(0, activeState.reloadTimer / activeSpec.reloadDuration)
      : 0;

  const lowHpOpacity = hud.hp <= 30 ? 0.36 : 0;
  const flashOpacity = hud.damageFlashTimer > 0 ? Math.min(0.65, hud.damageFlashTimer * 2.2) : 0;
  const vignetteOpacity = Math.max(lowHpOpacity, flashOpacity);
  const reticleHex = CROSSHAIR_HEX[hud.aimSettings.crosshairColor];

  return (
    <div
      data-testid="game-hud"
      className="fixed inset-0 z-10 pointer-events-none select-none"
    >
      {/* Crystal-Clear Dual-Zoom Sniper Scope Overlay */}
      {hud.isScoped && (
        <div
          data-testid="sniper-scope-overlay"
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 60%, rgba(4,7,12,0.52) 82%, rgba(4,7,12,0.82) 100%)',
          }}
        >
          {/* Thin Outer Optic Ring */}
          <div className="relative w-[min(82vh,82vw)] h-[min(82vh,82vw)] rounded-full border border-slate-300/35">
            {/* Full-Viewport Crisp Precision Hairlines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-slate-200/45" />
            <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-slate-200/45" />

            {/* Subtle Rangefinder Mil-Ticks */}
            <div className="absolute left-1/2 top-[28%] w-2.5 h-px -translate-x-1/2 bg-slate-200/60" />
            <div className="absolute left-1/2 top-[38%] w-2 h-px -translate-x-1/2 bg-slate-200/60" />
            <div className="absolute left-1/2 bottom-[28%] w-2.5 h-px -translate-x-1/2 bg-slate-200/60" />
            <div className="absolute left-1/2 bottom-[38%] w-2 h-px -translate-x-1/2 bg-slate-200/60" />
            <div className="absolute top-1/2 left-[28%] h-2.5 w-px -translate-y-1/2 bg-slate-200/60" />
            <div className="absolute top-1/2 left-[38%] h-2 w-px -translate-y-1/2 bg-slate-200/60" />
            <div className="absolute top-1/2 right-[28%] h-2.5 w-px -translate-y-1/2 bg-slate-200/60" />
            <div className="absolute top-1/2 right-[38%] h-2 w-px -translate-y-1/2 bg-slate-200/60" />

            {/* Zoom Multiplier Indicator */}
            <div className="absolute bottom-6 right-10 px-2 py-0.5 rounded bg-[rgba(8,12,18,0.78)] border border-slate-600/60 text-[11px] font-mono-num text-cyan-300">
              {hud.zoomTier === 2 ? '3.2x' : '1.8x'} · [Z]
            </div>
          </div>
        </div>
      )}

      {/* Peripheral Damage / Critical Health Vignette */}
      {vignetteOpacity > 0 && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-100"
          style={{
            opacity: vignetteOpacity,
            background:
              'radial-gradient(circle at center, rgba(185,28,28,0) 48%, rgba(185,28,28,0.85) 100%)',
          }}
        />
      )}

      {/* Top-Left Perimeter Cluster: Stage, Hostiles, Score, Breach */}
      <div className="fixed top-4 left-4 flex items-center gap-4 px-4 py-2.5 rounded bg-[rgba(10,14,20,0.88)] border border-slate-700/80 shadow-lg">
        <div>
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-amber-400">
            Stage {hud.round}/{hud.totalRounds} · {hud.stageName}
          </div>
          <div className="text-base sm:text-lg font-display font-bold text-slate-100 leading-tight whitespace-nowrap">
            {hud.roundTitle}
          </div>
        </div>
        <div className="h-8 w-px bg-slate-700/80" />
        <div>
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
            Sector Time
          </div>
          <div
            data-testid="hud-sector-timer"
            className={`text-2xl font-mono-num font-bold leading-none ${
              hud.stageClearReady ? 'text-emerald-300' : 'text-cyan-300'
            }`}
          >
            {hud.stageClearReady ? 'EXIT READY' : formatSectorTimer(hud.stageTimeRemaining)}
          </div>
        </div>
        <div className="h-8 w-px bg-slate-700/80" />
        <div>
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
            Wave · Kills
          </div>
          <div
            data-testid="hud-hostiles"
            className="text-2xl font-mono-num font-bold text-slate-100 leading-none"
          >
            W{hud.stageWave} · {hud.kills}
          </div>
        </div>
        <div className="h-8 w-px bg-slate-700/80" />
        <div>
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
            Score
          </div>
          <div
            data-testid="hud-score"
            className="text-2xl font-mono-num font-bold text-amber-300 leading-none"
          >
            {hud.score.toLocaleString()}
          </div>
        </div>
        <div className="h-8 w-px bg-slate-700/80 hidden md:block" />
        <div className="hidden md:block">
          <div className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
            Breach
          </div>
          <div
            data-testid="hud-destruction"
            className="text-2xl font-mono-num font-bold text-sky-300 leading-none"
          >
            {hud.destructionPercent}%
          </div>
        </div>
      </div>

      {/* Top-Right Utility Controls: Mute [M], Settings/Pause [P], Restart */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          aria-label={hud.muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
          title={hud.muted ? 'Unmute (M)' : 'Mute (M)'}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-10 h-10 rounded flex items-center justify-center bg-[rgba(10,14,20,0.88)] border border-slate-700/80 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" fillOpacity="0.2" />
            {hud.muted ? (
              <path d="M22 9l-6 6M16 9l6 6" strokeLinecap="round" />
            ) : (
              <>
                <path d="M15.5 8.5a5 5 0 010 7" strokeLinecap="round" />
                <path d="M19 5a9.5 9.5 0 010 14" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Aim settings & pause (P)"
          title="Settings & Pause (P)"
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="w-10 h-10 rounded flex items-center justify-center bg-[rgba(10,14,20,0.88)] border border-slate-700/80 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          aria-label="Restart run"
          title="Restart Run"
          onClick={(e) => {
            e.currentTarget.blur();
            onRestart();
          }}
          className="w-10 h-10 rounded flex items-center justify-center bg-[rgba(10,14,20,0.88)] border border-slate-700/80 text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Top-Right Compact Kill Feed */}
      {hud.killFeed.length > 0 && (
        <div className="fixed top-16 right-4 flex flex-col items-end gap-1 pointer-events-none">
          {hud.killFeed.map((entry) => (
            <div
              key={entry.id}
              data-testid="hud-killfeed-item"
              className={`px-2.5 py-1 rounded text-[11px] font-mono-num uppercase tracking-wider bg-[rgba(10,14,20,0.86)] border ${
                entry.headshot
                  ? 'border-amber-400/70 text-amber-300'
                  : 'border-slate-700/80 text-slate-200'
              }`}
            >
              {entry.label}
            </div>
          ))}
        </div>
      )}

      {/* Stage Clear Extraction Directive */}
      {hud.stageClearReady && (
        <div
          data-testid="hud-extraction-banner"
          className="fixed top-20 left-1/2 -translate-x-1/2 px-5 py-2 rounded bg-[rgba(6,44,32,0.92)] border border-emerald-400/80 shadow-xl"
        >
          <div className="text-xs font-mono-num font-bold tracking-widest uppercase text-emerald-300 whitespace-nowrap">
            SECTOR CLEAR · {hud.extractionPrompt.toUpperCase()} ({hud.extractionDistance}m)
          </div>
        </div>
      )}

      {/* Transient Wave Alert Banner */}
      {!hud.stageClearReady && hud.roundBannerTimer > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-5 py-2 rounded bg-[rgba(14,18,26,0.92)] border border-amber-500/70 shadow-xl">
          <div className="text-xs sm:text-sm font-display font-bold tracking-widest uppercase text-amber-300 whitespace-nowrap">
            {hud.roundBannerText}
          </div>
        </div>
      )}

      {/* Superpowered Giant Boss Health Bar */}
      {hud.bossActive && (
        <div
          data-testid="hud-boss-bar"
          className="fixed top-[124px] left-1/2 -translate-x-1/2 w-[min(420px,86vw)] px-4 py-2 rounded bg-[rgba(18,8,28,0.92)] border border-fuchsia-500/80 shadow-xl"
        >
          <div className="flex items-center justify-between text-[11px] font-mono-num uppercase tracking-wider mb-1">
            <span className="font-bold text-fuchsia-300">{hud.bossName}</span>
            <span className="text-fuchsia-200">
              {hud.bossHp} / {hud.bossMaxHp}
            </span>
          </div>
          <div className="h-2 w-full rounded-xs bg-slate-900 overflow-hidden border border-fuchsia-900/80">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-600 to-amber-400 transition-all duration-100"
              style={{
                width: `${Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100))}%`,
              }}
            />
          </div>
          {hud.bossPowerText && (
            <div className="mt-1 text-center text-[10px] font-mono-num font-bold tracking-widest uppercase text-amber-300">
              ⚡ {hud.bossPowerText}
            </div>
          )}
        </div>
      )}

      {/* Exact (0,0) Center Precision Crosshair & Hitmarker */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 48 48" className="w-11 h-11 overflow-visible">
          {!hud.isAds && (
            <>
              <line x1="24" y1="8" x2="24" y2="16" stroke={reticleHex} strokeWidth="2" strokeLinecap="round" />
              <line x1="24" y1="32" x2="24" y2="40" stroke={reticleHex} strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="24" x2="16" y2="24" stroke={reticleHex} strokeWidth="2" strokeLinecap="round" />
              <line x1="32" y1="24" x2="40" y2="24" stroke={reticleHex} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          <circle
            cx="24"
            cy="24"
            r={hud.isScoped ? 2.2 : hud.isAds ? 1.6 : 1.8}
            fill={hud.activeWeapon === 'rpg' ? '#f59e0b' : reticleHex}
            opacity={hud.isScoped ? 0.95 : hud.isAds ? 0.72 : 1}
          />

          {/* Reload Progress Ring */}
          {activeState.isReloading && (
            <circle
              cx="24"
              cy="24"
              r="18"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray={`${reloadProgress * 113} 113`}
              transform="rotate(-90 24 24)"
            />
          )}

          {/* Hitmarker X (Target Hits Only) */}
          {hud.hitmarkerTimer > 0 && (
            <g stroke={hud.hitmarkerKill ? '#ef4444' : '#f8fafc'} strokeWidth="2.6" strokeLinecap="round">
              <line x1="14" y1="14" x2="20" y2="20" />
              <line x1="34" y1="14" x2="28" y2="20" />
              <line x1="14" y1="34" x2="20" y2="28" />
              <line x1="34" y1="34" x2="28" y2="28" />
            </g>
          )}
        </svg>
      </div>

      {/* Target Hit Confirmation (Shown ONLY when hitting an enemy target, never shifts reticle) */}
      {hud.targetHitTimer > 0 && hud.targetHitLabel && (
        <div
          data-testid="hud-target-hit"
          className={`fixed left-1/2 top-[calc(50%+30px)] -translate-x-1/2 px-2.5 py-0.5 rounded text-[10px] font-mono-num font-bold tracking-wider uppercase whitespace-nowrap text-center border pointer-events-none ${
            hud.hitmarkerKill
              ? 'bg-[rgba(127,29,29,0.9)] border-red-400 text-red-100'
              : 'bg-[rgba(10,14,20,0.88)] border-amber-400/80 text-amber-300'
          }`}
        >
          {hud.targetHitLabel}
        </div>
      )}

      {/* Bottom-Left Perimeter Cluster: Vitality Pips & Health Bar */}
      <div className="fixed bottom-4 left-4 px-4 py-3 rounded bg-[rgba(10,14,20,0.88)] border border-slate-700/80 shadow-lg min-w-[220px]">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path
                d="M12 21s-7-4.4-9-9.2C1.4 7.9 4.2 4.5 7.7 4.5c2 0 3.6 1 4.3 2.4.7-1.4 2.3-2.4 4.3-2.4 3.5 0 6.3 3.4 4.7 7.3C19 16.6 12 21 12 21z"
                fill="#ef4444"
                stroke="#0f172a"
                strokeWidth="2"
              />
            </svg>
            <span className="text-[11px] font-mono-num uppercase tracking-widest text-slate-300">
              Armor / HP
            </span>
          </div>
          <span
            data-testid="hud-hp"
            className="text-2xl font-mono-num font-bold text-slate-100 leading-none"
          >
            {hud.hp}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          {[0, 1, 2, 3, 4].map((idx) => {
            const filled = idx < pipsFilled;
            return (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-xs border ${
                  filled
                    ? hud.hp <= 30
                      ? 'bg-red-500 border-red-300'
                      : 'bg-emerald-400 border-emerald-200'
                    : 'bg-slate-800 border-slate-700'
                }`}
              />
            );
          })}
        </div>

        <div className="relative h-2 w-full rounded-xs bg-slate-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-amber-400/70 transition-all duration-150"
            style={{ width: `${ghostPct}%` }}
          />
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-75 ${
              hud.hp <= 30 ? 'bg-red-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* Bottom-Right Perimeter Cluster: Tactical Strip, Ammo, 7-Weapon Arsenal & Frag Grenades */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono-num uppercase tracking-wider">
          <span
            data-testid="hud-ads-state"
            className={`px-2 py-0.5 rounded border ${
              hud.isAds
                ? 'bg-[rgba(34,197,94,0.2)] border-emerald-400 text-emerald-300'
                : 'bg-[rgba(10,14,20,0.86)] border-slate-700/80 text-slate-400'
            }`}
          >
            {hud.isScoped
              ? `Scope ${hud.zoomTier === 2 ? '3.2x' : '1.8x'} · [Z]`
              : hud.isAds
                ? 'ADS · Active'
                : 'RMB/V · ADS'}
          </span>
          <span
            data-testid="hud-grenades"
            className={`px-2 py-0.5 rounded border ${
              hud.grenades > 0
                ? 'bg-[rgba(16,185,129,0.16)] border-emerald-500/70 text-emerald-300'
                : 'bg-[rgba(10,14,20,0.86)] border-slate-700/80 text-slate-500'
            }`}
          >
            G · Frag ×{hud.grenades}
          </span>
          <span
            data-testid="hud-light-state"
            className={`px-2 py-0.5 rounded border ${
              hud.flashlightOn
                ? 'bg-[rgba(230,159,25,0.18)] border-amber-400/80 text-amber-300'
                : 'bg-[rgba(10,14,20,0.86)] border-slate-700/80 text-slate-400'
            }`}
          >
            L · Light {hud.flashlightOn ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Active Weapon Ammo Readout */}
        <div className="px-4 py-2 rounded bg-[rgba(10,14,20,0.88)] border border-slate-700/80 shadow-lg flex items-baseline gap-3">
          <div className="text-right">
            <div className="text-[10px] font-mono-num uppercase tracking-widest text-amber-400">
              {activeSpec.name}
            </div>
            <div className="text-[11px] text-slate-400">
              {activeState.isReloading
                ? 'Reloading...'
                : hud.targetHitTimer > 0
                  ? hud.targetHitLabel
                  : activeSpec.role}
            </div>
          </div>
          <div className="flex items-baseline gap-1 font-mono-num">
            <span
              data-testid="hud-ammo-mag"
              className={`text-3xl font-bold leading-none ${
                activeState.mag === 0 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {activeState.mag}
            </span>
            <span className="text-sm text-slate-400">/{activeState.reserve}</span>
          </div>
        </div>

        {/* 7-Weapon Switcher */}
        <div className="flex flex-wrap sm:flex-nowrap justify-end gap-1 pointer-events-auto">
          {WEAPON_ORDER.map((wid) => {
            const spec = WEAPON_SPECS[wid];
            const st = hud.weapons[wid];
            const isActive = hud.activeWeapon === wid;
            return (
              <button
                key={wid}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelectWeapon(wid);
                }}
                className={`px-2 py-1 rounded border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[rgba(230,159,25,0.24)] border-amber-400 text-amber-200'
                    : 'bg-[rgba(10,14,20,0.86)] border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-1 text-[10px] font-mono-num font-bold whitespace-nowrap">
                  <span className={isActive ? 'text-amber-300' : 'text-amber-400'}>[{spec.slot}]</span>
                  <span>{spec.shortName}</span>
                  <span className={isActive ? 'text-amber-100' : 'text-slate-400'}>{st.mag}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtle Pointer-Lock Hint only when unlocked during play */}
      {!hud.pointerLocked && !hud.isScoped && (
        <div className="fixed bottom-[118px] left-4 text-[11px] font-mono-num text-slate-300/80 hud-text-shadow whitespace-nowrap hidden lg:block">
          Click to lock aim · Drag to look · G Frag · 1-7 Guns
        </div>
      )}
    </div>
  );
};
