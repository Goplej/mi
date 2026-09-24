import type { Settings } from '../Core/types';

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master = 0.8;
  private engineVol = 0.7;
  private ambience = 0.45;
  private uiVol = 0.55;
  private engineGain: GainNode | null = null;
  private low: OscillatorNode | null = null;
  private mid: OscillatorNode | null = null;
  private noiseGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private roomGain: GainNode | null = null;
  private started = false;

  apply(settings: Settings): void {
    this.master = settings.master;
    this.engineVol = settings.engineVol;
    this.ambience = settings.ambience;
    this.uiVol = settings.uiVol;
    if (this.engineGain && this.ctx) this.engineGain.gain.value = this.engineVol * this.master;
    if (this.roomGain) this.roomGain.gain.value = this.ambience * this.master * 0.2;
  }

  unlock(): void {
    if (this.started) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const master = this.ctx.createGain();
    master.gain.value = 1;
    master.connect(this.ctx.destination);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(master);
    this.low = this.ctx.createOscillator();
    this.low.type = 'sawtooth';
    this.low.frequency.value = 40;
    const lowFilter = this.ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.value = 420;
    this.low.connect(lowFilter).connect(this.engineGain);
    this.mid = this.ctx.createOscillator();
    this.mid.type = 'square';
    this.mid.frequency.value = 80;
    const midGain = this.ctx.createGain();
    midGain.gain.value = 0.18;
    this.mid.connect(midGain).connect(this.engineGain);
    this.low.start();
    this.mid.start();

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer(this.ctx, 2);
    noise.loop = true;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180;
    bp.Q.value = 0.7;
    noise.connect(bp).connect(this.noiseGain).connect(this.engineGain);
    noise.start();

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    const rain = this.ctx.createBufferSource();
    rain.buffer = noiseBuffer(this.ctx, 2);
    rain.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    rain.connect(hp).connect(this.rainGain).connect(master);
    rain.start();

    this.roomGain = this.ctx.createGain();
    this.roomGain.gain.value = this.ambience * this.master * 0.15;
    const room = this.ctx.createBufferSource();
    room.buffer = noiseBuffer(this.ctx, 3);
    room.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    room.connect(lp).connect(this.roomGain).connect(master);
    room.start();
    this.started = true;
    void this.ctx.resume();
  }

  engine(rpm: number, throttle: number, running: boolean, electric: boolean): void {
    if (!this.ctx || !this.low || !this.mid || !this.engineGain || !this.noiseGain) return;
    const vol = (running ? 0.22 + throttle * 0.55 : 0) * this.engineVol * this.master;
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    const base = electric ? 70 + rpm * 0.01 : 32 + rpm * 0.018;
    this.low.frequency.setTargetAtTime(base, this.ctx.currentTime, 0.04);
    this.mid.frequency.setTargetAtTime(base * (electric ? 2.2 : 2), this.ctx.currentTime, 0.04);
    this.noiseGain.gain.setTargetAtTime(running ? 0.08 + throttle * 0.35 : 0, this.ctx.currentTime, 0.05);
  }

  rain(amount: number): void {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(amount * this.ambience * this.master, this.ctx.currentTime, 0.2);
  }

  room(indoors: boolean): void {
    if (!this.ctx || !this.roomGain) return;
    this.roomGain.gain.setTargetAtTime((indoors ? 0.22 : 0.08) * this.ambience * this.master, this.ctx.currentTime, 0.2);
  }

  click(): void {
    this.blip(880, 0.04, 'square', 0.08);
  }

  confirm(): void {
    this.blip(520, 0.06, 'sine', 0.1);
    window.setTimeout(() => this.blip(780, 0.08, 'sine', 0.08), 70);
  }

  deny(): void {
    this.blip(140, 0.12, 'sawtooth', 0.08);
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol * this.uiVol * this.master;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
