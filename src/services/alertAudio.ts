/**
 * Audio alert utility using the Web Audio API for subtle, non-intrusive notification sounds.
 * Synthesizes a gentle two-tone chime (soft bell/marimba harmonic curve).
 */
class AlertAudioService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.22; // Subtle, non-intrusive default (0.0 to 1.0)
  private lastAlertTimestamp: number = 0;
  private listeners: Array<() => void> = [];

  constructor() {
    // Attempt to load preference from localStorage if available
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedMute = window.localStorage.getItem('cyclone_audio_alert_muted');
        if (storedMute !== null) {
          this.isMuted = storedMute === 'true';
        }
        const storedVol = window.localStorage.getItem('cyclone_audio_alert_vol');
        if (storedVol !== null) {
          const parsed = parseFloat(storedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.volume = parsed;
          }
        }
      }
    } catch {
      // LocalStorage access may be restricted in sandboxes
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in audio alert listener:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('cyclone_audio_alert_muted', String(muted));
      }
    } catch {}
    this.notifyListeners();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('cyclone_audio_alert_vol', String(this.volume));
      }
    } catch {}
    this.notifyListeners();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getLastAlertTimestamp(): number {
    return this.lastAlertTimestamp;
  }

  /**
   * Plays a subtle, non-intrusive two-tone harmonic chime
   * Tone 1: 587.33 Hz (D5) -> Tone 2: 880.00 Hz (A5)
   * Designed to be acoustically gentle, distinct, and reassuring.
   */
  public playSubtleNotification(customVolume?: number): boolean {
    if (this.isMuted) return false;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return false;

      const now = ctx.currentTime;
      const baseVol = customVolume !== undefined ? customVolume : this.volume;

      // Master output gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(baseVol, now);
      masterGain.connect(ctx.destination);

      // --- Tone 1: D5 (587.33 Hz) Warm Soft Fundamental ---
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);

      // Gentle warm overtone (D6 at 1174.66 Hz, soft triangle)
      const overtone1 = ctx.createOscillator();
      const overtoneGain1 = ctx.createGain();
      overtone1.type = 'triangle';
      overtone1.frequency.setValueAtTime(1174.66, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.65, now + 0.018); // 18ms soft attack
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32); // 320ms exponential decay

      overtoneGain1.gain.setValueAtTime(0, now);
      overtoneGain1.gain.linearRampToValueAtTime(0.12, now + 0.018);
      overtoneGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain1);
      overtone1.connect(overtoneGain1);
      gain1.connect(masterGain);
      overtoneGain1.connect(masterGain);

      osc1.start(now);
      overtone1.start(now);
      osc1.stop(now + 0.35);
      overtone1.stop(now + 0.25);

      // --- Tone 2: A5 (880.00 Hz) Crisp, High-tech Resolution ---
      // Delayed by 95ms for an elegant ascending two-note chime
      const tone2Delay = 0.095;
      const t2Start = now + tone2Delay;

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, t2Start);

      // Soft marimba-like overtone (E6 at 1318.51 Hz)
      const overtone2 = ctx.createOscillator();
      const overtoneGain2 = ctx.createGain();
      overtone2.type = 'sine';
      overtone2.frequency.setValueAtTime(1318.51, t2Start);

      gain2.gain.setValueAtTime(0, t2Start);
      gain2.gain.linearRampToValueAtTime(0.7, t2Start + 0.018);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2Start + 0.42); // 420ms decay

      overtoneGain2.gain.setValueAtTime(0, t2Start);
      overtoneGain2.gain.linearRampToValueAtTime(0.08, t2Start + 0.018);
      overtoneGain2.gain.exponentialRampToValueAtTime(0.001, t2Start + 0.28);

      osc2.connect(gain2);
      overtone2.connect(overtoneGain2);
      gain2.connect(masterGain);
      overtoneGain2.connect(masterGain);

      osc2.start(t2Start);
      overtone2.start(t2Start);
      osc2.stop(t2Start + 0.45);
      overtone2.stop(t2Start + 0.3);

      this.lastAlertTimestamp = Date.now();
      this.notifyListeners();
      return true;
    } catch (e) {
      console.warn('Subtle audio alert failed:', e);
      return false;
    }
  }
}

export const alertAudio = new AlertAudioService();
