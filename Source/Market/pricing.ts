import type { GameState, ModelDef, VehicleInstance } from '../Core/types';
import { clamp, l10n } from '../Core/util';
import type { Analysis } from '../Vehicles/analysis';
import { seasonOf } from '../Core/util';

export function seasonDemand(cls: string, season: string): number {
  if (season === 'winter' && (cls === 'suv' || cls === 'utility')) return 1.16;
  if (season === 'summer' && (cls === 'sport' || cls === 'supercar')) return 1.14;
  if (season === 'spring' && cls === 'classic') return 1.1;
  if (season === 'autumn' && cls === 'premium') return 1.06;
  return 1;
}

export function appraise(state: GameState, model: ModelDef, vehicle: VehicleInstance, analysis: Analysis) {
  const age = Math.max(0, 2026 - vehicle.year);
  let yearFactor = model.class === 'classic' ? 1 + Math.min(0.8, age / 40) : clamp(1.08 - age * 0.018, 0.42, 1.12);
  const kmFactor = clamp(1.05 - vehicle.odometer / 420000, 0.38, 1.05);
  const cond =
    analysis.systems.body * 0.18 +
    analysis.systems.engine * 0.22 +
    analysis.systems.transmission * 0.12 +
    analysis.systems.brakes * 0.08 +
    analysis.systems.suspension * 0.08 +
    analysis.systems.electrical * 0.08 +
    analysis.systems.interior * 0.08 +
    analysis.systems.tires * 0.06 +
    (vehicle.paintCondition / 100) * 0.1;
  const rarity = { common: 1, uncommon: 1.12, rare: 1.35, legendary: 1.7 }[model.rarity];
  const demand = (state.market.demand[model.class] ?? 1) * seasonDemand(model.class, state.market.season || seasonOf(Math.floor(state.clock.absolute / 1440) + 1));
  const paint = 0.82 + (vehicle.paintCondition / 100) * 0.22;
  const dirt = 1 - vehicle.dirt / 400;
  let mods = 1;
  if (analysis.powerHp > model.engine.power * 1.08) mods += Math.min(0.12, (analysis.powerHp / model.engine.power - 1) * 0.25);
  if (vehicle.repairLog.length > 2) mods += 0.03;
  if (vehicle.projectId && cond > 0.78 && analysis.start.fires && Object.values(analysis.parts).every((p) => !p.missing)) {
    mods += 0.55;
  }
  let fraud = 1;
  if (vehicle.trueOdometer > vehicle.odometer * 1.3) {
    fraud = state.flags[`disclosed:${vehicle.id}`] ? 0.78 : 0.92;
  }
  const market = Math.max(
    400,
    Math.round(model.baseValue * yearFactor * kmFactor * (0.45 + cond * 0.7) * rarity * demand * state.market.index * paint * dirt * mods * fraud),
  );
  const showroom = state.garage.upgrades.includes('showroom') ? 1.06 : 1;
  return {
    market: Math.round(market * showroom),
    dealer: Math.round(market * 0.78),
    privateAsk: Math.round(market * 0.98),
    conditionScore: Math.round(cond * 100),
    breakdown: [
      { label: l10n('Год и класс', 'Year and class'), factor: yearFactor },
      { label: l10n('Пробег', 'Mileage'), factor: kmFactor },
      { label: l10n('Состояние узлов', 'Mechanical state'), factor: 0.45 + cond * 0.7 },
      { label: l10n('Спрос и сезон', 'Demand and season'), factor: demand * state.market.index },
      { label: l10n('Краска и грязь', 'Paint and dirt'), factor: paint * dirt },
      { label: l10n('История и доработки', 'History and mods'), factor: mods * fraud },
    ],
  };
}

export function saleChance(asking: number, fair: number, salesperson: boolean, reputation: number): number {
  const ratio = asking / Math.max(1, fair);
  let p = 0.22;
  if (ratio < 0.85) p = 0.72;
  else if (ratio < 1) p = 0.48;
  else if (ratio < 1.12) p = 0.28;
  else if (ratio < 1.3) p = 0.12;
  else p = 0.04;
  if (salesperson) p += 0.12;
  p += Math.min(0.1, reputation / 4000);
  return clamp(p, 0.02, 0.9);
}

export function partPrice(base: number, qualityMul: number, category: string, state: GameState, featuredDiscount = 1): number {
  const cat = state.market.categoryMul[category] ?? 1;
  const warehouse = state.garage.upgrades.includes('warehouse') ? 0.92 : 1;
  const index = 0.92 + state.market.index * 0.1;
  return Math.max(8, Math.round(base * qualityMul * cat * warehouse * featuredDiscount * index));
}
