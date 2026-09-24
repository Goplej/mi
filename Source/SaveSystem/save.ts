import type { GameState, Settings } from '../Core/types';
import { SAVE_VERSION } from '../Core/types';
import { deepClone } from '../Core/util';

export interface SaveFile {
  version: number;
  savedAt: number;
  state: GameState;
}

export function exportState(state: GameState): string {
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: deepClone(state),
  };
  return JSON.stringify(file);
}

export function importState(raw: string): GameState {
  const parsed = JSON.parse(raw) as SaveFile | GameState;
  const state = 'state' in parsed && parsed.state ? parsed.state : (parsed as GameState);
  if (!state || state.version !== SAVE_VERSION) {
    throw new Error('save-version');
  }
  if (!state.vehicles || !state.parts || !state.economy || !state.garage) throw new Error('save-shape');
  for (const v of state.vehicles) {
    if (!v.panels) v.panels = { hood: false, trunk: false, doors: {}, lift: false, jack: null };
    if (!v.tune) v.tune = { ecuPower: 0, ride: 0, aero: 0 };
    if (!v.runtime) v.runtime = { running: false, rpm: 0, temp: 20, throttle: 0 };
    v.runtime.running = false;
    v.runtime.throttle = 0;
  }
  if (!state.work) state.work = { active: null, queue: [] };
  if (!state.setups) state.setups = [];
  if (!state.collectionSold) state.collectionSold = [];
  return state;
}

export function slotKey(slot: number): string {
  return slot === 0 ? 'garage-empire-autosave' : `garage-empire-slot-${slot}`;
}

export function defaultSettings(): Settings {
  return {
    lang: 'ru',
    quality: 'medium',
    master: 0.8,
    engineVol: 0.7,
    ambience: 0.45,
    uiVol: 0.55,
    shake: true,
    hints: true,
    autosave: true,
    invert: false,
  };
}

export function loadSettings(): Settings {
  try {
    if (typeof localStorage === 'undefined') return defaultSettings();
    const raw = localStorage.getItem('garage-empire-settings');
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export function storeSettings(settings: Settings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('garage-empire-settings', JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

export interface SlotInfo {
  slot: number;
  empty: boolean;
  company?: string;
  day?: number;
  cash?: number;
  savedAt?: number;
  reputation?: number;
}

export function readSlot(slot: number): GameState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    return importState(raw);
  } catch {
    return null;
  }
}

export function writeSlot(slot: number, state: GameState): void {
  if (typeof localStorage === 'undefined') throw new Error('no-storage');
  localStorage.setItem(slotKey(slot), exportState(state));
}

export function deleteSlot(slot: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(slotKey(slot));
}

export function listSlots(): SlotInfo[] {
  const slots: SlotInfo[] = [];
  for (let i = 0; i <= 5; i++) {
    const st = readSlot(i);
    if (!st) {
      slots.push({ slot: i, empty: true });
      continue;
    }
    slots.push({
      slot: i,
      empty: false,
      company: st.meta.company,
      day: Math.floor(st.clock.absolute / 1440) + 1,
      cash: st.economy.cash,
      savedAt: Date.now(),
      reputation: st.reputation,
    });
  }
  return slots;
}

export function latestSlot(): number | null {
  if (typeof localStorage === 'undefined') return null;
  let best: number | null = null;
  let bestAt = 0;
  for (let i = 0; i <= 5; i++) {
    const raw = localStorage.getItem(slotKey(i));
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SaveFile;
      const at = parsed.savedAt ?? 0;
      if (at >= bestAt) {
        bestAt = at;
        best = i;
      }
    } catch {
      if (best == null) best = i;
    }
  }
  return best;
}
