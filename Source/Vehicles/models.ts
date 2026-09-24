import vehiclesJson from '../../Assets/data/vehicles.json';
import type { GearboxKind, ModelDef } from '../Core/types';

const REQUIRED = ['id', 'brand', 'model', 'class', 'body', 'drive', 'mass', 'engine', 'baseValue', 'size'] as const;

function validate(raw: unknown): ModelDef[] {
  if (!Array.isArray(raw)) throw new Error('vehicles.json must be an array');
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') throw new Error('vehicle entry is not an object');
    const m = item as ModelDef;
    for (const key of REQUIRED) {
      if ((m as unknown as Record<string, unknown>)[key] == null) throw new Error(`vehicle missing ${key}`);
    }
    if (ids.has(m.id)) throw new Error(`duplicate vehicle id ${m.id}`);
    ids.add(m.id);
    if (!m.engine.power || !m.engine.arch) throw new Error(`engine incomplete on ${m.id}`);
  }
  return raw as ModelDef[];
}

export const MODELS: ModelDef[] = validate(vehiclesJson);
const byId = new Map(MODELS.map((m) => [m.id, m]));

export function modelById(id: string): ModelDef {
  const m = byId.get(id);
  if (!m) throw new Error(`Unknown model ${id}`);
  return m;
}

export function tryModel(id: string): ModelDef | undefined {
  return byId.get(id);
}

export function defaultGears(kind: GearboxKind): number[] {
  if (kind === 'manual') return [3.45, 1.95, 1.32, 0.97, 0.75];
  if (kind === 'automatic') return [4.1, 2.4, 1.58, 1.14, 0.86, 0.68];
  if (kind === 'dct') return [3.9, 2.45, 1.78, 1.34, 1.04, 0.84, 0.67];
  return [9];
}

export function gearsOf(model: ModelDef): number[] {
  return model.gears && model.gears.length ? model.gears : defaultGears(model.gearbox);
}

export function finalDriveOf(model: ModelDef): number {
  if (model.finalDrive) return model.finalDrive;
  if (model.powertrain === 'electric') return 1;
  if (model.drive === 'RWD') return 3.4;
  if (model.drive === 'AWD') return 3.7;
  return 3.95;
}

export function wheelRadiusOf(model: ModelDef): number {
  return model.wheelRadius ?? (model.class === 'suv' || model.class === 'utility' ? 0.36 : 0.32);
}

export function modelsByClass(cls: string): ModelDef[] {
  return MODELS.filter((m) => m.class === cls);
}

export const BRANDS = [...new Set(MODELS.map((m) => m.brand))];
