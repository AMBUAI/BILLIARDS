export interface AudioSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  sfxEnabled: true,
  musicEnabled: false,
  sfxVolume: 0.75,
  musicVolume: 0.35,
};

class CasinoSoundEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;

  constructor() {
    try {
      const saved = localStorage.getItem('gr8b_audio_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AudioSettings>;
        this.settings = {
          sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true,
          musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : false,
          sfxVolume:
            typeof parsed.sfxVolume === 'number'
              ? Math.max(0, Math.min(1, parsed.sfxVolume))
              : 0.75,
          musicVolume:
            typeof parsed.musicVolume === 'number'
              ? Math.max(0, Math.min(1, parsed.musicVolume))
              : 0.35,
        };
      }
    } catch {
      // ignore storage errors
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem('gr8b_audio_settings', JSON.stringify(this.settings));
    } catch {
      // ignore
    }

    if (this.settings.musicEnabled) {
      this.startMusicLoop();
    } else {
      this.stopMusicLoop();
    }

    return this.getSettings();
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (this.settings.musicEnabled && !this.musicTimer) {
      this.startMusicLoop();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private effectiveSfxGain(base: number): number {
    if (!this.settings.sfxEnabled) return 0;
    return base * this.settings.sfxVolume;
  }

  public playMenuClick(): void {
    const vol = this.effectiveSfxGain(0.18);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playCueStrike(power: number, isBreak = false): void {
    const vol = this.effectiveSfxGain(0.35 + power * 0.45);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Leather tip thwack (woody transient)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isBreak ? 260 : 210 + power * 90, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.065);

    oscGain.gain.setValueAtTime(vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    // Crisp chalk/tip snap
    const bufferSize = Math.floor(ctx.sampleRate * 0.025);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.6;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  public playBallCollision(intensity: number): void {
    const clamped = Math.max(0.05, Math.min(1, intensity));
    const vol = this.effectiveSfxGain(0.14 + clamped * 0.42);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Phenolic resin ball clack: two sharp resonant modes
    const freqs = [2150, 3980];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + (idx === 0 ? clamped * 220 : 0), now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, now + 0.028);

      gain.gain.setValueAtTime(vol * (idx === 0 ? 0.65 : 0.4), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    });
  }

  public playCushionBounce(intensity: number): void {
    const clamped = Math.max(0.08, Math.min(1, intensity));
    const vol = this.effectiveSfxGain(0.12 + clamped * 0.28);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.065);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playPocketDrop(): void {
    const vol = this.effectiveSfxGain(0.36);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Leather cup thud + subtle secondary rattle
    [0, 0.065].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 130 : 95, now + offset);
      osc.frequency.exponentialRampToValueAtTime(48, now + offset + 0.09);

      gain.gain.setValueAtTime(vol * (idx === 0 ? 0.85 : 0.45), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.095);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  public playVictory(): void {
    const vol = this.effectiveSfxGain(0.28);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  public playDefeat(): void {
    const vol = this.effectiveSfxGain(0.24);
    if (vol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 311.13, 261.63]; // G4 F4 Eb4 C4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.14;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer || !this.settings.musicEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Gentle 1990s casino lounge Dm9 -> G13 -> Cmaj9 -> A7alt progression
    const chords = [
      [146.83, 261.63, 329.63, 349.23], // Dm9
      [196.0, 293.66, 329.63, 349.23],  // G13
      [130.81, 246.94, 293.66, 329.63], // Cmaj9
      [110.0, 207.65, 261.63, 329.63],  // A7#9
    ];

    const playBar = () => {
      if (!this.settings.musicEnabled || !this.ctx) return;
      if (this.ctx.state !== 'running') return;
      const vol = this.settings.musicVolume * 0.055;
      if (vol <= 0.001) return;

      const chord = chords[this.musicStep % chords.length];
      this.musicStep++;
      const now = this.ctx.currentTime;

      chord.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.value = 650;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 2.4);
      });
    };

    playBar();
    this.musicTimer = setInterval(playBar, 2400);
  }

  public stopMusicLoop(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundEngine = new CasinoSoundEngine();
