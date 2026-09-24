import type { GameState, L10n, VehicleInstance } from '../Core/types';
import { hasCapability } from '../Tools/definitions';
import { slotById } from '../Vehicles/assembly';
import { modelById } from '../Vehicles/models';

export function inBay(v: VehicleInstance): boolean {
  return v.location.startsWith('bay:');
}

export function liftAvailable(state: GameState): boolean {
  if (!state.garage.upgrades.includes('lift')) return false;
  const until = Number(state.flags.liftBrokenUntil ?? 0);
  return state.clock.absolute >= until;
}

export function doorOpen(v: VehicleInstance): boolean {
  ensurePanels(v);
  if (Object.values(v.panels.doors).some(Boolean)) return true;
  return Object.keys(v.slots).some((id) => id.startsWith('door_') && v.slots[id] == null);
}

export function ensurePanels(v: VehicleInstance): void {
  if (!v.panels) {
    v.panels = { hood: false, trunk: false, doors: {}, lift: false, jack: null };
  }
  if (!v.panels.doors) v.panels.doors = {};
}

export function accessProblem(state: GameState, v: VehicleInstance, slotId: string, needBay = true): L10n | null {
  ensurePanels(v);
  if (needBay && !inBay(v)) return { ru: 'Машину нужно загнать в бокс.', en: 'Move the car into a bay.' };
  const spec = slotById(modelById(v.modelId), slotId);
  if (!spec) return { ru: 'Такого узла у этой машины нет.', en: 'This car does not have that part.' };
  const acc = spec.access;
  if (acc.panel === 'hood' && !v.panels.hood && v.slots.hood) {
    return { ru: 'Сначала откройте или снимите капот.', en: 'Open or remove the hood first.' };
  }
  if (acc.panel === 'trunk' && !v.panels.trunk && v.slots.trunk) {
    return { ru: 'Сначала откройте багажник.', en: 'Open the trunk first.' };
  }
  if (acc.panel === 'door' && !doorOpen(v) && !Object.keys(v.slots).some((id) => id.startsWith('door_') && !v.slots[id])) {
    return { ru: 'Сначала откройте дверь.', en: 'Open a door first.' };
  }
  const lifted = v.panels.lift && liftAvailable(state);
  if (acc.lift && !lifted) return { ru: 'Нужен подъёмник. Домкрат сюда не достаёт.', en: 'A lift is required. The jack does not reach here.' };
  if (acc.jackCorner && !lifted && v.panels.jack !== acc.jackCorner) {
    return { ru: 'Поднимите этот угол домкратом или машину подъёмником.', en: 'Jack this corner or raise the car on the lift.' };
  }
  for (const req of acc.removed ?? []) {
    if (v.slots[req]) return { ru: `Сначала снимите: ${req}.`, en: `Remove first: ${req}.` };
  }
  for (const tool of spec.tools) {
    if (tool === 'hoist' && (liftAvailable(state) || hasCapability(state.garage.tools, state.garage.upgrades, 'hoist'))) continue;
    if (tool === 'jack' && lifted) continue;
    if (!hasCapability(state.garage.tools, state.garage.upgrades, tool) && !state.garage.tools.includes(tool)) {
      return { ru: `Нужен инструмент: ${tool}.`, en: `Tool required: ${tool}.` };
    }
  }
  return null;
}

export function actionMinutes(state: GameState, v: VehicleInstance, slotId: string, actorSpeed = 1): number {
  const spec = slotById(modelById(v.modelId), slotId);
  if (!spec) return 10;
  let m = spec.minutes;
  if (state.garage.tools.includes('compressor') && spec.tools.includes('wrench')) m *= 0.75;
  const internal = ['pistons', 'crankshaft', 'camshaft', 'valves', 'cylinderHead', 'engineBlock', 'headGasket', 'gearbox'].includes(spec.type);
  if (internal && !state.garage.upgrades.includes('engineShop')) m *= 2.5;
  const skill = Number(state.flags.playerSkill ?? 2);
  m *= Math.max(0.72, 1.12 - skill * 0.03);
  m /= actorSpeed;
  return Math.max(1, Math.round(m));
}
