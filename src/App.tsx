// Created by Md Shabbir Mia
import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ModalOverlay } from './components/ModalOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { SubwayGameEngine } from './game/SubwayGameEngine';
import { DEFAULT_AIM_SETTINGS, STAGE_DURATION_SECONDS, createInitialWeapons } from './game/rules';
import { AimSettings, HudSnapshot, StageId, WeaponId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  victory: false,
  hp: 100,
  maxHp: 100,
  ghostHp: 100,
  score: 0,
  bestScore: 0,
  kills: 0,
  headshots: 0,
  round: 1,
  totalRounds: 4,
  stageName: 'Subway Station',
  roundTitle: '14th St. Metro',
  roundEnemiesRemaining: 10,
  stageTimeRemaining: STAGE_DURATION_SECONDS,
  stageDurationSeconds: STAGE_DURATION_SECONDS,
  stageWave: 1,
  stageClearReady: false,
  extractionPrompt: '',
  extractionDistance: 0,
  roundBannerTimer: 0,
  roundBannerText: '',
  destructionPercent: 0,
  destroyedCount: 0,
  totalDestructibleCount: 0,
  activeWeapon: 'carbine',
  weapons: createInitialWeapons(),
  grenades: 3,
  maxGrenades: 5,
  hitmarkerTimer: 0,
  hitmarkerKill: false,
  targetHitTimer: 0,
  targetHitLabel: '',
  damageFlashTimer: 0,
  pointerLocked: false,
  muted: false,
  elapsedSeconds: 0,
  isAds: false,
  isScoped: false,
  zoomTier: 1,
  flashlightOn: true,
  isSprinting: false,
  killFeed: [],
  aimSettings: { ...DEFAULT_AIM_SETTINGS },
  startStage: 1,
  bossActive: false,
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  bossPowerText: '',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SubwayGameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new SubwayGameEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    const params = new URLSearchParams(window.location.search);
    const stageParam = Number(params.get('stage'));
    const validStage: StageId | undefined =
      stageParam >= 1 && stageParam <= 4 ? (stageParam as StageId) : undefined;
    const durationParam = Number(params.get('stageDuration'));
    if (Number.isFinite(durationParam) && durationParam > 0) {
      engine.setStageDurationOverride(durationParam);
    }
    if (validStage) {
      engine.setStartStage(validStage);
    }
    if (params.get('autostart') === '1') {
      engine.startNewGame(false, validStage);
      if (params.get('boss') === '1') {
        engine.spawnStageBoss();
      }
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    engineRef.current?.startNewGame(true);
  };

  const handleSelectStage = (stage: StageId) => {
    engineRef.current?.setStartStage(stage);
  };

  const handleSelectWeapon = (id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  };

  const handleToggleMute = () => {
    engineRef.current?.toggleMute();
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleTitle = () => {
    engineRef.current?.returnToTitle();
  };

  const handleUpdateAimSettings = (partial: Partial<AimSettings>) => {
    engineRef.current?.updateAimSettings(partial);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070a0f]">
      {/* Isolated WebGL canvas container (never re-created on React HUD updates) */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-mount"
        className="absolute inset-0 w-full h-full"
      />

      {hud.phase === 'title' && (
        <TitleOverlay
          onStart={handleStart}
          bestScore={hud.bestScore}
          selectedStage={hud.startStage}
          onSelectStage={handleSelectStage}
        />
      )}

      {hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          onSelectWeapon={handleSelectWeapon}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleStart}
        />
      )}

      {(hud.phase === 'paused' || hud.phase === 'gameover') && (
        <ModalOverlay
          hud={hud}
          onResume={handleResume}
          onRestart={handleStart}
          onTitle={handleTitle}
          onUpdateAimSettings={handleUpdateAimSettings}
        />
      )}
    </main>
  );
}
