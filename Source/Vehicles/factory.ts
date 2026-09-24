import type { Difficulty, GameState, ModelDef, VehicleInstance, VehicleTune } from '../Core/types';
import { RNG } from '../Core/rng';
import { l10n, uid, vinFor } from '../Core/util';
import { createPart } from '../VehicleParts/build';
import { slotsFor } from './assembly';
import { modelById } from './models';

export interface SpawnOptions {
  modelId: string;
  year?: number;
  odometer?: number;
  neglect?: number;
  color?: string;
  role?: VehicleInstance['role'];
  location?: VehicleInstance['location'];
  forced?: { slot: string; condition: number }[];
  missing?: string[];
  fraud?: boolean;
  projectId?: string;
  projectTitle?: { ru: string; en: string };
  paint?: number;
  dirt?: number;
  ownerName?: string;
}

const COLORS = ['#1c2430', '#8d1d2c', '#c4552a', '#1f4b8f', '#d8d2c6', '#2f3438', '#6b7c3a', '#e6e1d8', '#12352f', '#f0f2f4', '#4d6d8a', '#7a1f3d'];

function tune(): VehicleTune {
  return { ecuPower: 0, ride: 0, aero: 0 };
}

export function createVehicle(state: GameState, rng: RNG, opt: SpawnOptions): VehicleInstance {
  const model = modelById(opt.modelId);
  const year = opt.year ?? rng.int(model.yearMin, model.yearMax);
  const age = Math.max(0, 2026 - year);
  const odometer = opt.odometer ?? Math.round(rng.int(8000, 22000) * Math.max(1, age * 0.85));
  const neglect = opt.neglect ?? rng.float(0.25, 0.75);
  const id = uid(state, 'car');
  const slots: Record<string, string | null> = {};
  const missing = new Set(opt.missing ?? []);
  const forced = new Map((opt.forced ?? []).map((f) => [f.slot, f.condition]));

  for (const spec of slotsFor(model)) {
    if (spec.optional && !forced.has(spec.id) && !missing.has(spec.id)) {
      slots[spec.id] = null;
      continue;
    }
    if (missing.has(spec.id)) {
      slots[spec.id] = null;
      continue;
    }
    const wear = neglect * (0.35 + Math.min(1, odometer / 280000) * 0.65);
    let condition = 100 - wear * rng.float(28, 62) - age * rng.float(0.2, 0.8);
    condition += (1 - neglect) * 8;
    if (spec.system === 'body') condition += 6;
    if (forced.has(spec.id)) condition = forced.get(spec.id)!;
    condition = Math.max(4, Math.min(96, Math.round(condition)));
    const part = createPart(
      state,
      {
        type: spec.type,
        size: spec.size,
        quality: age > 18 ? 'used' : 'oem',
        brand: age > 18 ? null : model.brand,
        condition,
        manufacturer: age > 18 ? 'Yard Row' : `${model.brand} OE`,
      },
      state.clock?.absolute ?? 0,
      0,
    );
    part.installedIn = id;
    part.slot = spec.id;
    part.mileage = Math.round(odometer * rng.float(0.4, 1));
    state.parts[part.uid] = part;
    slots[spec.id] = part.uid;
  }

  const trueOdo = opt.fraud ? Math.round(odometer * rng.float(1.45, 1.9)) : odometer;
  const owners = [
    {
      name: opt.ownerName ?? rng.pick(['Семья Ремезовых', 'Городской парк', 'Частник', 'Прокат «Север»']),
      fromYear: year,
      toYear: 2026,
      note: l10n('Предыдущий владелец.', 'Previous owner.'),
    },
  ];
  const vehicle: VehicleInstance = {
    id,
    vin: vinFor(model.brand, year, state.seq),
    modelId: model.id,
    year,
    odometer: opt.fraud ? odometer : trueOdo,
    trueOdometer: trueOdo,
    color: opt.color ?? rng.pick(COLORS),
    paintCondition: opt.paint ?? Math.max(8, Math.round(78 - neglect * 40 - age * 0.7)),
    dirt: opt.dirt ?? Math.round(neglect * rng.float(15, 55)),
    fuel: rng.float(0.25, 0.7),
    role: opt.role ?? 'owned',
    location: opt.location ?? 'parking',
    slots,
    inspected: [],
    clues: [],
    scanned: false,
    deepScanned: false,
    owners,
    repairLog: [],
    purchasedPrice: 0,
    acquiredAt: state.clock?.absolute ?? 0,
    projectId: opt.projectId,
    projectTitle: opt.projectTitle,
    aligned: neglect < 0.3,
    tune: tune(),
    telemetry: [],
    panels: { hood: false, trunk: false, doors: {}, lift: false, jack: null },
    runtime: { running: false, rpm: 0, temp: 20, throttle: 0 },
    lights: false,
    notes: '',
    suspected: [],
    serviceStamp: 0,
  };
  state.vehicles.push(vehicle);
  return vehicle;
}

export function createStarter(state: GameState, rng: RNG, difficulty: Difficulty): VehicleInstance {
  const neglect = difficulty === 'easy' ? 0.55 : difficulty === 'hard' ? 0.85 : 0.7;
  const forced = [
    { slot: 'battery', condition: difficulty === 'easy' ? 20 : difficulty === 'hard' ? 8 : 11 },
    { slot: 'sparkPlugs', condition: difficulty === 'hard' ? 14 : 26 },
    { slot: 'oil', condition: 12 },
    { slot: 'oilFilter', condition: 18 },
    { slot: 'brakePad_fl', condition: 22 },
    { slot: 'brakePad_fr', condition: 24 },
    { slot: 'brakeDisc_fl', condition: 42 },
    { slot: 'airFilter', condition: 26 },
    { slot: 'shock_fl', condition: 34 },
    { slot: 'wheel_fl', condition: 38 },
    { slot: 'wheel_fr', condition: 40 },
    { slot: 'fender_fl', condition: 28 },
  ];
  return createVehicle(state, rng, {
    modelId: 'drava-kombi',
    year: 1998,
    odometer: difficulty === 'hard' ? 346000 : 287400,
    neglect,
    color: '#4d6d8a',
    role: 'owned',
    location: 'bay:0',
    forced,
    paint: difficulty === 'hard' ? 22 : 34,
    dirt: 62,
    ownerName: 'Четвёртый владелец',
  });
}

export function projectPreset(kind: string, rng: RNG): SpawnOptions {
  if (kind === 'abandoned-sport') {
    return {
      modelId: 'marcelli-strada',
      year: rng.int(2014, 2017),
      odometer: rng.int(160000, 220000),
      neglect: 0.95,
      color: '#4a1218',
      missing: ['turbo', 'seat_fl', 'splitter'],
      forced: [
        { slot: 'pistons', condition: 8 },
        { slot: 'engineBlock', condition: 16 },
        { slot: 'paint', condition: 12 },
        { slot: 'fender_fl', condition: 14 },
        { slot: 'fender_fr', condition: 18 },
        { slot: 'hood', condition: 20 },
        { slot: 'interior', condition: 10 },
      ].filter((f) => f.slot !== 'paint' && f.slot !== 'interior'),
      paint: 12,
      dirt: 80,
      projectId: 'abandoned-sport',
      projectTitle: l10n('Заброшенный спорткар', 'Abandoned sports car'),
    };
  }
  if (kind === 'barn-classic') {
    return {
      modelId: rng.chance(0.5) ? 'ashford-sovereign' : 'nordheim-silber',
      year: undefined,
      neglect: 0.9,
      missing: ['exhaust', 'seat_fr'],
      forced: [
        { slot: 'floor' as string, condition: 10 },
        { slot: 'fender_rl', condition: 12 },
        { slot: 'fender_rr', condition: 15 },
        { slot: 'rocker' as string, condition: 8 },
        { slot: 'door_fl', condition: 22 },
        { slot: 'battery', condition: 6 },
        { slot: 'brakeLines', condition: 14 },
      ].filter((f) => !f.slot.includes('floor') && !f.slot.includes('rocker')),
      paint: 10,
      dirt: 70,
      projectId: 'barn-classic',
      projectTitle: l10n('Классика из сарая', 'Barn classic'),
    };
  }
  return {
    modelId: 'vektor-gt3',
    neglect: 0.8,
    missing: ['wing', 'wheel_fl'],
    forced: [
      { slot: 'brakePad_fl', condition: 8 },
      { slot: 'brakeDisc_fl', condition: 14 },
      { slot: 'gearbox', condition: 22 },
    ],
    paint: 40,
    dirt: 30,
    projectId: 'race-shell',
    projectTitle: l10n('Гоночный остов', 'Race shell'),
  };
}

export function modelLabel(model: ModelDef): { ru: string; en: string } {
  return { ru: `${model.brand} ${model.model}`, en: `${model.brand} ${model.model}` };
}
