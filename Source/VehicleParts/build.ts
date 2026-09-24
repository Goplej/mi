import type { GameState, PartInstance, PartSize, Quality } from '../Core/types';
import { l10n, uid } from '../Core/util';
import { MANUFACTURERS, partType, qualityDef } from './catalog';

export interface PartRequest {
  type: string;
  size: PartSize;
  quality: Quality;
  brand: string | null;
  condition?: number;
  manufacturer?: string;
}

export function defKeyOf(type: string, size: string, quality: string, brand: string | null): string {
  return `${type}|${size}|${quality}|${brand ?? 'universal'}`;
}

export function parseDefKey(key: string): { type: string; size: PartSize; quality: Quality; brand: string | null } {
  const [type, size, quality, brand] = key.split('|');
  return {
    type,
    size: size as PartSize,
    quality: quality as Quality,
    brand: brand === 'universal' ? null : brand,
  };
}

export function partDisplayName(type: string, quality: Quality, brand: string | null, manufacturer: string): { ru: string; en: string } {
  const def = partType(type);
  const q = {
    used: { ru: 'б/у', en: 'used' },
    aftermarket: { ru: 'аналог', en: 'aftermarket' },
    oem: { ru: 'оригинал', en: 'OEM' },
    performance: { ru: 'спорт', en: 'performance' },
    racing: { ru: 'гоночная', en: 'racing' },
  }[quality];
  const brandBit = brand ? ` ${brand}` : '';
  return {
    ru: `${manufacturer}${brandBit} · ${def.name.ru} · ${q.ru}`,
    en: `${manufacturer}${brandBit} · ${def.name.en} · ${q.en}`,
  };
}

export function createPart(state: { seq: number }, req: PartRequest, at: number, price = 0): PartInstance {
  const def = partType(req.type);
  const q = qualityDef(req.quality);
  const manufacturer = req.manufacturer ?? MANUFACTURERS[req.quality][0];
  const condition = req.condition ?? q.cond[1];
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(def.stats)) stats[k] = v * q.stat;
  if (req.type === 'wheel') {
    const grip = stats.grip ?? q.stat;
    stats.grip = grip;
    stats.wetGrip =
      req.quality === 'racing' ? 0.58 : req.quality === 'performance' ? 0.78 : req.quality === 'used' ? 0.8 : req.quality === 'oem' ? 0.9 : 0.96;
    stats.wetGrip *= 0.7 + 0.3 * (condition / 100);
  }
  if (req.type === 'turbo') {
    stats.powerMul = (req.quality === 'racing' ? 1.38 : req.quality === 'performance' ? 1.22 : req.quality === 'oem' ? 1.12 : 1.08) * (0.55 + 0.45 * q.stat / 1.32);
  }
  const tags = [`type:${req.type}`, `size:${req.size}`, `quality:${req.quality}`];
  if (req.brand && req.quality === 'oem') tags.push(`brand:${req.brand}`);
  else tags.push('universal');
  if (def.rare || req.quality === 'racing') tags.push('rare');
  return {
    uid: uid(state, 'part'),
    defKey: defKeyOf(req.type, req.size, req.quality, req.brand && req.quality === 'oem' ? req.brand : null),
    type: req.type,
    name: partDisplayName(req.type, req.quality, req.brand && req.quality === 'oem' ? req.brand : null, manufacturer),
    manufacturer,
    quality: req.quality,
    size: req.size,
    brand: req.brand && req.quality === 'oem' ? req.brand : null,
    tags,
    condition,
    mileage: 0,
    weight: def.weight * q.weight,
    stats,
    wear: def.wear * q.wear,
    consumable: def.consumable,
    repairable: def.repairable && !def.consumable,
    installedIn: null,
    slot: null,
    purchasedAt: at,
    purchasePrice: price,
  };
}

export function fitsVehicle(part: PartInstance, type: string, size: PartSize, brand: string): boolean {
  if (part.type !== type) return false;
  if (part.size !== size) return false;
  if (part.tags.includes('universal')) return true;
  if (part.brand === brand) return true;
  return false;
}

export function scrapValue(part: PartInstance): number {
  return Math.max(5, Math.round(part.purchasePrice * 0.08 + part.condition * 0.4));
}

export function placeholderName(): { ru: string; en: string } {
  return l10n('Деталь', 'Part');
}

export function stockQualityForAge(year: number, nowYear = 2026): Quality {
  return nowYear - year > 20 ? 'used' : 'oem';
}

void (0 as unknown as GameState);
