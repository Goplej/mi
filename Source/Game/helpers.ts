import type { GameState, L10n, VehicleInstance } from '../Core/types';
import { RNG } from '../Core/rng';
import { bayCount, parkingCount } from '../Tools/definitions';
import { clamp, l10n, money } from '../Core/util';
import { notify } from '../Economy/economy';

export interface ActionResult {
  ok: boolean;
  message?: L10n;
}

export function ok(message?: L10n): ActionResult {
  return { ok: true, message };
}

export function fail(ru: string, en: string): ActionResult {
  return { ok: false, message: l10n(ru, en) };
}

export function pullRng(state: GameState): RNG {
  const rng = new RNG(state.rng || state.meta.seed || 1);
  return rng;
}

export function pushRng(state: GameState, rng: RNG): void {
  state.rng = rng.seed;
}

export function yardLimit(state: GameState): number {
  return 2 + (state.garage.upgrades.includes('warehouse') ? 1 : 0);
}

export function showroomLimit(state: GameState): number {
  return state.garage.upgrades.includes('showroom') ? 2 : 0;
}

export function capacity(state: GameState): number {
  return bayCount(state.garage.upgrades) + parkingCount(state.garage.upgrades) + yardLimit(state) + showroomLimit(state);
}

export function occupying(state: GameState): VehicleInstance[] {
  return state.vehicles.filter((v) => v.location !== 'offsite' && v.role !== 'market' && v.role !== 'auction' && v.role !== 'junk');
}

export function hasSpace(state: GameState): boolean {
  return occupying(state).length < capacity(state);
}

export function addRep(state: GameState, delta: number): void {
  state.reputation = clamp(state.reputation + delta, 0, 1000);
}

export function repTitle(rep: number): L10n {
  if (rep >= 920) return l10n('Автомобильная империя', 'Automotive empire');
  if (rep >= 800) return l10n('Дом для VIP', 'House of VIPs');
  if (rep >= 650) return l10n('Премиум-ателье', 'Premium atelier');
  if (rep >= 450) return l10n('Уважаемое имя', 'Respected name');
  if (rep >= 250) return l10n('Надёжный сервис', 'Trusted service');
  if (rep >= 100) return l10n('Местная мастерская', 'Local shop');
  return l10n('Неизвестный гараж', 'Unknown garage');
}

export function skillGain(state: GameState, amount = 0.015): void {
  const cur = Number(state.flags.playerSkill ?? 2);
  state.flags.playerSkill = Math.min(10, cur + amount);
}

export function destroyVehicle(state: GameState, id: string, keepLooseParts = true): void {
  const v = state.vehicles.find((c) => c.id === id);
  if (!v) return;
  for (const uid of Object.values(v.slots)) {
    if (!uid) continue;
    const p = state.parts[uid];
    if (!p) continue;
    if (keepLooseParts && p.installedIn !== id) continue;
    if (p.installedIn === id) delete state.parts[uid];
  }
  state.garage.inventory = state.garage.inventory.filter((uid) => state.parts[uid]);
  state.vehicles = state.vehicles.filter((c) => c.id !== id);
}

export function findBay(state: GameState): number | null {
  const bays = bayCount(state.garage.upgrades);
  for (let i = 0; i < bays; i++) {
    if (!state.vehicles.some((v) => v.location === `bay:${i}`)) return i;
  }
  return null;
}

export function toast(state: GameState, kind: 'info' | 'good' | 'bad' | 'warn', text: L10n): void {
  notify(state, kind, text);
}

export function moneyOk(state: GameState, amount: number): boolean {
  return state.economy.cash >= money(amount);
}

export function syncGarage(state: GameState): void {
  state.garage.bays = bayCount(state.garage.upgrades);
  state.garage.parking = parkingCount(state.garage.upgrades);
}
