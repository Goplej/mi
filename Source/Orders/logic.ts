import content from '../../Assets/data/content.json';
import type { GameState, L10n, Order, OrderOutcome, VehicleInstance } from '../Core/types';
import { RNG } from '../Core/rng';
import { clamp, l10n, uid } from '../Core/util';
import { analyze } from '../Vehicles/analysis';
import { createVehicle } from '../Vehicles/factory';
import { MODELS, modelById } from '../Vehicles/models';

export interface OrderTemplate {
  id: string;
  minRep: number;
  maxRep: number;
  difficulty: number;
  classes: string[];
  powertrain?: string;
  deadline: [number, number];
  budget: [number, number];
  payout: [number, number];
  weight: number;
  personality: Order['personality'][];
  title: L10n;
  say: L10n;
  brief: L10n;
  faults: { slot: string; min: number; max: number; chance?: number }[];
  outcomes: string[];
  paint?: [number, number];
  dirt?: [number, number];
  paintRequest?: boolean;
  needsTent?: boolean;
}

export const TEMPLATES = content.orders as OrderTemplate[];
const NAMES = content.names.customers as string[];

export function slotCond(state: GameState, v: VehicleInstance, slot: string): number {
  const uidPart = v.slots[slot];
  if (!(slot in v.slots)) return 100;
  if (!uidPart) return 0;
  return state.parts[uidPart]?.condition ?? 0;
}

export function outcomeMet(state: GameState, order: Order, v: VehicleInstance, id: string, param?: number): boolean {
  const model = modelById(v.modelId);
  const a = analyze(model, v, state.parts);
  switch (id) {
    case 'starts':
      return a.start.fires;
    case 'fluids_fresh':
      return model.powertrain === 'electric'
        ? slotCond(state, v, 'coolant') >= 80
        : slotCond(state, v, 'oil') >= 88 && slotCond(state, v, 'oilFilter') >= 80;
    case 'brakes_ok':
      return a.brake >= 0.72 && ['fl', 'fr', 'rl', 'rr'].every((c) => slotCond(state, v, `brakePad_${c}`) >= 60);
    case 'charging':
      return model.powertrain === 'electric'
        ? slotCond(state, v, 'bms') >= 55 && slotCond(state, v, 'isolation') >= 55
        : slotCond(state, v, 'alternator') >= 58 && slotCond(state, v, 'belts') >= 45 && slotCond(state, v, 'wiring') >= 40;
    case 'idle_stable':
      return a.start.fires && a.misfire < 0.28;
    case 'no_overheat':
      return a.cooling >= 0.66;
    case 'no_pull':
      return a.pull < 0.28;
    case 'no_vibration':
      return a.vibration < 0.3;
    case 'paint_quality':
      return v.paintCondition >= 78 && v.dirt < 24 && (!order.paintColor || v.color.toLowerCase() === order.paintColor.toLowerCase());
    case 'body_solid':
      return a.bodyScore >= 62;
    case 'interior_ok':
      return a.interiorScore >= 60 && v.dirt < 35;
    case 'lights_ok':
      return a.lightsScore >= 72;
    case 'no_ecu_critical':
      return a.codes.length === 0 && slotCond(state, v, 'ecu') >= 40;
    case 'tires_ok':
      return a.tireScore >= 58 && Object.keys(v.slots).filter((s) => s.startsWith('wheel_')).every((s) => v.slots[s]);
    case 'accel_target': {
      const target = param ?? 10;
      return v.telemetry.some(
        (t) =>
          t.at >= (order.acceptedAt ?? 0) &&
          t.zeroTo100 != null &&
          t.zeroTo100 <= target &&
          t.weather !== 'rain' &&
          t.weather !== 'heavy-rain' &&
          t.weather !== 'snow',
      );
    }
    default:
      return false;
  }
}

export function outcomeText(id: string, param?: number): L10n {
  const map: Record<string, L10n> = {
    starts: l10n('Двигатель уверенно запускается', 'The engine starts reliably'),
    fluids_fresh: l10n('Масло и фильтр свежие', 'Oil and filter are fresh'),
    brakes_ok: l10n('Тормоза держат, колодки не изношены', 'Brakes hold and the pads are not worn'),
    charging: l10n('Зарядка в норме', 'Charging system is healthy'),
    idle_stable: l10n('Холостой ход ровный', 'Idle is stable'),
    no_overheat: l10n('Охлаждение держит температуру', 'Cooling holds temperature'),
    no_pull: l10n('Машину не уводит', 'The car does not pull'),
    no_vibration: l10n('Нет гула и вибрации', 'No hum or vibration'),
    paint_quality: l10n('Краска ровная и совпадает с запросом', 'Paint is even and matches the request'),
    body_solid: l10n('Кузов без критических панелей', 'The body has no critical panels'),
    interior_ok: l10n('Салон приведён в порядок', 'The cabin is in order'),
    lights_ok: l10n('Свет исправен', 'Lights work'),
    no_ecu_critical: l10n('Нет активных кодов ECU', 'No active ECU codes'),
    tires_ok: l10n('Резина пригодна', 'Tires are usable'),
    accel_target: l10n(`Сухой 0–100 не хуже ${param ?? '?'} с`, `Dry 0–100 no worse than ${param ?? '?'} s`),
  };
  return map[id] ?? l10n(id, id);
}

export function offerCount(state: GameState): number {
  return 1 + Math.floor(state.reputation / 280) + (state.garage.upgrades.includes('office') ? 1 : 0);
}

export function canSpawnTemplate(state: GameState, t: OrderTemplate): boolean {
  if (state.reputation < t.minRep || state.reputation > t.maxRep) return false;
  if (t.needsTent && !state.garage.upgrades.includes('raceTent') && state.reputation < 800) return false;
  if (t.id === 'race_prep' && state.reputation < 650 && !state.garage.upgrades.includes('raceTent')) return false;
  return true;
}

export function createOffer(state: GameState, rng: RNG, templateId?: string): Order | null {
  const active = state.orders.filter((o) => o.status === 'offered' || o.status === 'active').length;
  if (active >= offerCount(state) + 2) return null;
  const pool = TEMPLATES.filter((t) => canSpawnTemplate(state, t) && (!templateId || t.id === templateId));
  if (!pool.length) return null;
  const template = templateId ? pool[0] : rng.weighted(pool.map((t) => ({ item: t, w: t.weight })));
  const diff = state.meta.difficulty === 'easy' ? 1.15 : state.meta.difficulty === 'hard' ? 0.82 : 1;
  const manager = state.employees.some((e) => e.role === 'manager') ? 1.06 : 1;
  const payout = Math.round(rng.int(template.payout[0], template.payout[1]) * diff * manager);
  const order: Order = {
    id: uid(state, 'order'),
    templateId: template.id,
    customer: rng.pick(NAMES),
    personality: rng.pick(template.personality),
    title: template.title,
    brief: template.brief,
    say: template.say,
    budget: Math.round(rng.int(template.budget[0], template.budget[1]) * diff),
    payoutBase: payout,
    deadline: 0,
    status: 'offered',
    vehicleId: '',
    outcomes: template.outcomes.map((id) => ({ id, text: outcomeText(id) })),
    difficulty: template.difficulty,
    reputationWeight: 1 + template.difficulty * 0.2,
    invoice: payout,
    createdAt: state.clock.absolute,
  };
  if (template.paintRequest) {
    order.paintColor = rng.pick(['#8d1d2c', '#1f4b8f', '#e8e4dc', '#141414', '#1aa37a', '#c4552a']);
  }
  state.orders.unshift(order);
  return order;
}

export function acceptOrder(state: GameState, rng: RNG, order: Order): VehicleInstance | null {
  const template = TEMPLATES.find((t) => t.id === order.templateId);
  if (!template) return null;
  const models = MODELS.filter((m) => template.classes.includes(m.class) && (!template.powertrain || m.powertrain === template.powertrain));
  if (!models.length) return null;
  const model = rng.pick(models);
  const v = createVehicle(state, rng, {
    modelId: model.id,
    neglect: 0.22,
    role: 'customer',
    location: 'yard',
    ownerName: order.customer,
    paint: template.paint ? rng.int(template.paint[0], template.paint[1]) : undefined,
    dirt: template.dirt ? rng.int(template.dirt[0], template.dirt[1]) : 18,
  });
  v.orderId = order.id;
  for (const f of template.faults) {
    if (f.chance != null && !rng.chance(f.chance)) continue;
    if (!(f.slot in v.slots)) continue;
    const pid = v.slots[f.slot];
    if (!pid || !state.parts[pid]) continue;
    state.parts[pid].condition = rng.int(f.min, f.max);
  }
  const days = rng.int(template.deadline[0], template.deadline[1]);
  const patience = order.personality === 'calm' ? 1 : order.personality === 'rushed' || order.personality === 'vip' ? 0 : 0;
  order.acceptedAt = state.clock.absolute;
  order.deadline = state.clock.absolute + (days + patience) * 1440;
  order.vehicleId = v.id;
  order.status = 'active';
  if (template.outcomes.includes('accel_target')) {
    const target = clamp((1550 / model.engine.power) * (model.mass / 1200) * 1.2, 3.6, 18);
    const rounded = Math.round(target * 10) / 10;
    order.outcomes = order.outcomes.map((o) =>
      o.id === 'accel_target' ? { ...o, param: rounded, text: outcomeText('accel_target', rounded) } : o,
    );
  }
  return v;
}

export function gradeOrder(state: GameState, order: Order, v: VehicleInstance): { met: number; total: number; ratio: number; lines: { id: string; ok: boolean; text: L10n }[] } {
  const lines = order.outcomes.map((o: OrderOutcome) => ({
    id: o.id,
    ok: outcomeMet(state, order, v, o.id, o.param),
    text: o.text,
  }));
  const met = lines.filter((l) => l.ok).length;
  return { met, total: lines.length, ratio: lines.length ? met / lines.length : 0, lines };
}
