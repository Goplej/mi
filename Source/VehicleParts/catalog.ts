import partsJson from '../../Assets/data/parts.json';
import type { L10n, PartSize, PartTypeDef, Quality, QualityDef } from '../Core/types';

export const QUALITIES = partsJson.qualities as QualityDef[];
export const PART_TYPES = partsJson.types as PartTypeDef[];
export const MANUFACTURERS = partsJson.manufacturers as Record<Quality, string[]>;

const typeMap = new Map(PART_TYPES.map((p) => [p.id, p]));
const qualityMap = new Map(QUALITIES.map((q) => [q.id, q]));

export function partType(id: string): PartTypeDef {
  const t = typeMap.get(id);
  if (!t) throw new Error(`Unknown part type ${id}`);
  return t;
}

export function qualityDef(id: Quality): QualityDef {
  const q = qualityMap.get(id);
  if (!q) throw new Error(`Unknown quality ${id}`);
  return q;
}

export function hasPartType(id: string): boolean {
  return typeMap.has(id);
}

export const PART_GROUPS: { id: string; name: L10n }[] = [
  { id: 'body', name: { ru: 'Кузов', en: 'Body' } },
  { id: 'interior', name: { ru: 'Салон', en: 'Interior' } },
  { id: 'brakes', name: { ru: 'Тормоза и колёса', en: 'Brakes and wheels' } },
  { id: 'suspension', name: { ru: 'Подвеска', en: 'Suspension' } },
  { id: 'engine', name: { ru: 'Двигатель', en: 'Engine' } },
  { id: 'transmission', name: { ru: 'Трансмиссия', en: 'Transmission' } },
  { id: 'electrical', name: { ru: 'Электрика', en: 'Electrical' } },
];

export const LONG_BLOCK_SLOTS = [
  'engineBlock',
  'pistons',
  'crankshaft',
  'camshaft',
  'valves',
  'cylinderHead',
  'headGasket',
];

export function effectiveStat(base: number, condition: number, neutral = 1): number {
  const c = Math.max(0, Math.min(100, condition)) / 100;
  if (base === neutral) return neutral;
  return neutral + (base - neutral) * c;
}
