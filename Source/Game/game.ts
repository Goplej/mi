import type { GameState, Settings } from '../Core/types';
import { RNG } from '../Core/rng';
import { createNewGame, type NewGameOptions } from './newGame';
import { importState } from '../SaveSystem/save';
import { advanceMinutes, bootstrapWorld, netWorth, objectives } from './tick';
import { pullRng, pushRng, repTitle } from './helpers';
import { analyze } from '../Vehicles/analysis';
import { modelById } from '../Vehicles/models';
import { appraise } from '../Market/pricing';
import * as actions from './actions';

export class Game {
  state: GameState;

  private constructor(state: GameState, boot: boolean) {
    this.state = state;
    if (boot) bootstrapWorld(this.state);
  }

  static create(opts: NewGameOptions): Game {
    return new Game(createNewGame(opts), true);
  }

  static fromSave(raw: string | GameState): Game {
    const state = typeof raw === 'string' ? importState(raw) : importState(JSON.stringify({ version: raw.version, savedAt: Date.now(), state: raw }));
    return new Game(state, false);
  }

  rng(): RNG {
    return pullRng(this.state);
  }

  commitRng(rng: RNG): void {
    pushRng(this.state, rng);
  }

  update(realSeconds: number, driving = false): void {
    if (this.state.meta.bankrupt) return;
    this.state.meta.playSeconds += realSeconds;
    if (this.state.clock.paused || driving) return;
    const minutes = realSeconds * this.state.clock.speed;
    advanceMinutes(this.state, minutes);
  }

  advance(minutes: number): void {
    advanceMinutes(this.state, minutes);
  }

  setPaused(paused: boolean): void {
    this.state.clock.paused = paused;
  }

  setSpeed(speed: number): void {
    this.state.clock.speed = speed <= 0 ? 0 : speed;
    this.state.clock.paused = speed <= 0;
  }

  waitUntilMorning(): void {
    const minute = this.state.clock.absolute % 1440;
    const target = minute < 8 * 60 ? 8 * 60 - minute : 1440 - minute + 8 * 60;
    this.state.clock.paused = false;
    advanceMinutes(this.state, target);
  }

  analysis(id: string) {
    const v = actions.vehicleOf(this.state, id);
    if (!v) return null;
    return analyze(modelById(v.modelId), v, this.state.parts);
  }

  appraisal(id: string) {
    const v = actions.vehicleOf(this.state, id);
    if (!v) return null;
    const a = analyze(modelById(v.modelId), v, this.state.parts);
    return appraise(this.state, modelById(v.modelId), v, a);
  }

  netWorth(): number {
    return netWorth(this.state);
  }

  objectives() {
    return objectives(this.state);
  }

  reputationTitle() {
    return repTitle(this.state.reputation);
  }

  applySettings(settings: Settings): void {
    this.state.settings = { ...this.state.settings, ...settings };
  }

  act(name: keyof typeof actions, ...args: unknown[]) {
    const fn = actions[name];
    if (typeof fn !== 'function') return { ok: false, message: { ru: 'Нет такой команды.', en: 'No such command.' } };
    const rng = this.rng();
    const result = (fn as (...a: unknown[]) => unknown)(this.state, ...args.map((a) => (a === '__rng' ? rng : a)));
    this.commitRng(rng);
    return result;
  }
}

export function runCommand(game: Game, name: string, ...args: unknown[]) {
  const table = actions as unknown as Record<string, (...a: unknown[]) => unknown>;
  const fn = table[name];
  if (!fn) return { ok: false, message: { ru: `Неизвестная команда ${name}`, en: `Unknown command ${name}` } };
  const rng = game.rng();
  const mapped = args.map((a) => (a === '__rng' ? rng : a));
  const result = fn(game.state, ...insertRng(name, mapped, rng));
  game.commitRng(rng);
  return result;
}

function insertRng(name: string, args: unknown[], rng: RNG): unknown[] {
  if (name === 'acceptJob' || name === 'resolveEvent' || name === 'searchStaff') return [rng, ...args];
  return args;
}

export { actions };
