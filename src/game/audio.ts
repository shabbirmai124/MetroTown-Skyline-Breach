// Created by Md Shabbir Mia
import { SurfaceMaterial, WeaponId } from './types';

export class SubwayAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private ambienceGain: GainNode | null = null;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.75, this.ctx.currentTime, 0.03);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.75;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.startSubwayAmbience();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setAmbienceActive(active: boolean): void {
    if (!this.ambienceGain || !this.ctx) return;
    this.ambienceGain.gain.setTargetAtTime(active ? 0.045 : 0.0, this.ctx.currentTime, 0.25);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startSubwayAmbience(): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 50;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 110;

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = 0;

    osc.connect(filter);
    filter.connect(this.ambienceGain);
    this.ambienceGain.connect(this.masterGain);
    osc.start();
  }

  public playFootstep(onMetalTrain: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;

    if (onMetalTrain) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(62 * pitchVar, t + 0.09);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420 * pitchVar;
      filter.Q.value = 1.4;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.08);
    }
  }

  public playWeaponFire(weapon: WeaponId): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const pitchVar = 0.94 + Math.random() * 0.12;

    if (weapon === 'pistol') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360 * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.07);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.09);
      this.playFilteredBurst(2100 * pitchVar, 1.0, 0.075, 0.26);
    } else if (weapon === 'smg') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280 * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(68, t + 0.055);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.07);
      this.playFilteredBurst(2400 * pitchVar, 1.2, 0.06, 0.24);
    } else if (weapon === 'carbine' || weapon === 'lmg') {
      const isLmg = weapon === 'lmg';
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime((isLmg ? 170 : 210) * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(44, t + (isLmg ? 0.11 : 0.09));
      oscGain.gain.setValueAtTime(isLmg ? 0.36 : 0.32, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.13);
      this.playFilteredBurst((isLmg ? 1300 : 1650) * pitchVar, 0.85, 0.12, isLmg ? 0.4 : 0.34);
    } else if (weapon === 'sniper') {
      // Thunderous .50 cal rifle crack + resonant tail
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165 * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.34);
      g.gain.setValueAtTime(0.62, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
      this.playFilteredBurst(1900, 0.65, 0.28, 0.55);
    } else if (weapon === 'shotgun') {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 * pitchVar, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.22);
      oscGain.gain.setValueAtTime(0.55, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, t);
        filter.frequency.exponentialRampToValueAtTime(350, t + 0.26);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.48, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.29);
      }
    } else {
      const thump = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(135, t);
      thump.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      tGain.gain.setValueAtTime(0.45, t);
      tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      thump.connect(tGain);
      tGain.connect(this.masterGain);
      thump.start(t);
      thump.stop(t + 0.21);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(520, t);
        filter.frequency.linearRampToValueAtTime(1400, t + 0.32);
        filter.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.36, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        src.start(t);
        src.stop(t + 0.38);
      }
    }
  }

  public playGrenadeThrow(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.playFilteredBurst(780, 1.4, 0.14, 0.2);
  }

  public playGrenadeBounce(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.06);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playZoomClick(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250, t);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  public playMaterialImpact(material: SurfaceMaterial): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const p = 0.9 + Math.random() * 0.2;

    switch (material) {
      case 'metal': {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'square';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(980 * p, t);
        osc1.frequency.exponentialRampToValueAtTime(520 * p, t + 0.16);
        osc2.frequency.setValueAtTime(2240 * p, t);
        osc2.frequency.exponentialRampToValueAtTime(1680 * p, t + 0.19);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.21);
        osc2.stop(t + 0.21);
        break;
      }
      case 'tile': {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2800 * p, t);
        osc.frequency.exponentialRampToValueAtTime(1100 * p, t + 0.055);
        g.gain.setValueAtTime(0.19, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.07);
        this.playFilteredBurst(3600 * p, 2.2, 0.05, 0.16);
        break;
      }
      case 'glass': {
        const freqs = [3100, 4250, 5400];
        freqs.forEach((f, idx) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f * p, t + idx * 0.014);
          g.gain.setValueAtTime(0.13, t + idx * 0.014);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + idx * 0.02);
          osc.connect(g);
          g.connect(this.masterGain);
          osc.start(t + idx * 0.014);
          osc.stop(t + 0.22);
        });
        this.playFilteredBurst(4800, 1.0, 0.14, 0.2);
        break;
      }
      case 'wood': {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(310 * p, t);
        osc.frequency.exponentialRampToValueAtTime(135 * p, t + 0.08);
        g.gain.setValueAtTime(0.24, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);
        this.playFilteredBurst(950 * p, 1.8, 0.05, 0.14);
        break;
      }
      case 'flesh': {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(155 * p, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.075);
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.09);
        this.playFilteredBurst(620 * p, 1.1, 0.05, 0.18);
        break;
      }
      case 'concrete':
      default: {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 * p, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.06);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.075);
        this.playFilteredBurst(1550 * p, 1.5, 0.06, 0.15);
        break;
      }
    }
  }

  private playFilteredBurst(
    freq: number,
    q: number,
    duration: number,
    volume: number,
  ): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.65);
    subGain.gain.setValueAtTime(0.72, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 0.75);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + 0.85);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.6, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.92);
    }
  }

  public playReloadClick(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.setValueAtTime(920, t + 0.06);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  public playZombieTelegraph(heavy: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 110 : 280, t);
    osc.frequency.linearRampToValueAtTime(heavy ? 185 : 440, t + 0.28);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.22);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playPickup(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.setValueAtTime(780, t + 0.06);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playRoundAlert(aggressive: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = aggressive ? [440, 330, 520] : [360, 480];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.14);
      g.gain.setValueAtTime(0.18, t + idx * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.22);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + idx * 0.14);
      osc.stop(t + idx * 0.14 + 0.24);
    });
  }

  public playBossSpawn(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.72);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
    this.playFilteredBurst(380, 1.1, 0.55, 0.25);
  }

  public playBossPower(power: 'slam' | 'plasma' | 'dash'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (power === 'slam') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.52);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.58);
    } else if (power === 'plasma') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.24);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.linearRampToValueAtTime(420, t + 0.3);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.36);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.ambienceGain = null;
      this.noiseBuffer = null;
    }
  }
}
