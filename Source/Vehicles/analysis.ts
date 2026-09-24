import type { L10n, ModelDef, PartInstance, VehicleInstance } from '../Core/types';
import { avg, clamp, conditionState, minOf } from '../Core/util';
import { effectiveStat } from '../VehicleParts/catalog';
import { slotsFor } from './assembly';

export interface Symptom {
  id: string;
  system: string;
  severity: number;
  text: L10n;
  sources: Array<'visual' | 'sound' | 'scan' | 'multimeter' | 'compression' | 'testdrive' | 'idle' | 'history'>;
}

export interface EcuCode {
  id: string;
  system: string;
  text: L10n;
}

export interface StartReport {
  cranks: boolean;
  fires: boolean;
  chance: number;
  reasons: L10n[];
}

export interface Analysis {
  parts: Record<string, { condition: number; missing: boolean; type: string; system: string }>;
  systems: Record<string, number>;
  symptoms: Symptom[];
  codes: EcuCode[];
  start: StartReport;
  powerHp: number;
  torqueNm: number;
  mass: number;
  grip: number;
  wetGrip: number;
  brake: number;
  cooling: number;
  fuelMul: number;
  reliability: number;
  handling: number;
  aero: number;
  drag: number;
  electrical: number;
  misfire: number;
  overheat: number;
  pull: number;
  vibration: number;
  smoke: 'none' | 'blue' | 'white' | 'black';
  noises: string[];
  canDrive: boolean;
  driveBlock: L10n | null;
  fraudSuspected: boolean;
  bodyScore: number;
  paintScore: number;
  interiorScore: number;
  tireScore: number;
  lightsScore: number;
  compression: number[];
  batteryVoltage: number;
  chargingVoltage: number;
  sensorSkew: number;
  turboBoost: number;
  electric: boolean;
  diesel: boolean;
}

type Bag = Record<string, PartInstance | null>;

function bagFor(model: ModelDef, vehicle: VehicleInstance, parts: Record<string, PartInstance>): Bag {
  const bag: Bag = {};
  for (const spec of slotsFor(model)) {
    if (!(spec.id in vehicle.slots)) {
      bag[spec.id] = spec.optional ? null : null;
      continue;
    }
    const uid = vehicle.slots[spec.id];
    bag[spec.id] = uid ? parts[uid] ?? null : null;
  }
  return bag;
}

function cond(bag: Bag, id: string, ifAbsent = 100): number {
  if (!(id in bag)) return ifAbsent;
  const p = bag[id];
  if (!p) return 0;
  return p.condition;
}

function present(bag: Bag, id: string): boolean {
  return id in bag && bag[id] != null;
}

function stat(bag: Bag, id: string, key: string, neutral = 1): number {
  const p = bag[id];
  if (!p) return neutral;
  return effectiveStat(p.stats[key] ?? neutral, p.condition, neutral);
}

function minSlots(bag: Bag, ids: string[]): number {
  const vals = ids.filter((id) => id in bag).map((id) => cond(bag, id));
  return minOf(vals, 100);
}

function avgSlots(bag: Bag, ids: string[]): number {
  const vals = ids.filter((id) => id in bag).map((id) => cond(bag, id));
  return avg(vals.length ? vals : [100]);
}

function soft(value: number, dead: number, full: number): number {
  if (value <= dead) return 0;
  if (value >= full) return 1;
  return (value - dead) / (full - dead);
}

export function analyze(
  model: ModelDef,
  vehicle: VehicleInstance,
  parts: Record<string, PartInstance>,
): Analysis {
  const bag = bagFor(model, vehicle, parts);
  const electric = model.powertrain === 'electric';
  const diesel = model.engine.fuel === 'diesel';
  const turboCar = model.engine.aspiration === 'turbo' || model.engine.aspiration === 'twin-turbo';
  const corners = ['fl', 'fr', 'rl', 'rr'];

  const partInfo: Analysis['parts'] = {};
  for (const spec of slotsFor(model)) {
    if (!(spec.id in vehicle.slots) && spec.optional) continue;
    const missing = !vehicle.slots[spec.id];
    partInfo[spec.id] = {
      condition: missing ? 0 : parts[vehicle.slots[spec.id] as string]?.condition ?? 0,
      missing,
      type: spec.type,
      system: spec.system,
    };
  }

  const bodyIds = Object.keys(partInfo).filter((id) => partInfo[id].system === 'body' && !id.startsWith('wing') && !id.startsWith('splitter') && partInfo[id].type !== 'headlight' && partInfo[id].type !== 'taillight');
  const bodyScore = avg(bodyIds.map((id) => partInfo[id].missing ? 20 : partInfo[id].condition));
  const lightIds = ['headlight_l', 'headlight_r', 'taillight_l', 'taillight_r'].filter((id) => id in partInfo);
  const lightsScore = avg(lightIds.map((id) => (partInfo[id].missing ? 0 : partInfo[id].condition)));
  const interiorIds = ['seat_fl', 'seat_fr', 'dashboard', 'steeringWheel'].filter((id) => id in partInfo);
  const interiorScore = avg(interiorIds.map((id) => (partInfo[id].missing ? 25 : partInfo[id].condition)));
  const tireScore = avg(corners.map((c) => cond(bag, `wheel_${c}`)));

  const structuralIds = ['engineBlock', 'pistons', 'crankshaft', 'cylinderHead'].filter((id) => id in bag);
  const structural = electric ? cond(bag, 'motor') : minSlots(bag, structuralIds);
  const compressionHealth = electric
    ? 1
    : minSlots(bag, ['pistons', 'valves', 'cylinderHead', 'headGasket', 'engineBlock']) / 100;
  const spark = electric || diesel ? 100 : minSlots(bag, ['sparkPlugs', 'ignitionCoils']);
  const fuelDelivery = electric ? 100 : minSlots(bag, ['fuelPump', 'fuelLines', 'injectors']);
  const air = electric ? 100 : minSlots(bag, ['airFilter', 'throttleBody', 'intake']);
  const coolingParts = electric
    ? ['radiator', 'coolant']
    : ['radiator', 'waterPump', 'thermostat', 'coolant', 'fan'];
  let cooling = minSlots(bag, coolingParts) / 100;
  if (!electric && cond(bag, 'headGasket') < 40) cooling *= cond(bag, 'headGasket') / 40;
  if (turboCar && 'intercooler' in bag) cooling *= 0.75 + 0.25 * (cond(bag, 'intercooler') / 100);

  const pad = avg(corners.map((c) => cond(bag, `brakePad_${c}`)));
  const disc = avg(corners.map((c) => cond(bag, `brakeDisc_${c}`)));
  const cal = avg(corners.map((c) => cond(bag, `caliper_${c}`)));
  const fluid = cond(bag, 'brakeFluid');
  const lines = cond(bag, 'brakeLines');
  let brake =
    (pad / 100) * 0.4 +
    (disc / 100) * 0.25 +
    (cal / 100) * 0.2 +
    (fluid / 100) * 0.1 +
    (lines / 100) * 0.05;
  const stuck = corners.some((c) => present(bag, `caliper_${c}`) && cond(bag, `caliper_${c}`) < 22);
  if (stuck) brake *= 0.72;
  if (fluid < 18 || lines < 15) brake *= 0.55;

  const shock = avg(corners.map((c) => cond(bag, `shock_${c}`)));
  const spring = avg(corners.map((c) => cond(bag, `spring_${c}`)));
  const arm = avg(corners.map((c) => cond(bag, `arm_${c}`)));
  const bearing = avg(corners.map((c) => cond(bag, `bearing_${c}`)));
  const hub = avg(corners.map((c) => cond(bag, `hub_${c}`)));
  const suspension = avg([shock, spring, arm, bearing, hub, cond(bag, 'swayBar')]) / 100;

  const worstArm = minSlots(bag, corners.map((c) => `arm_${c}`));
  const worstSpring = minSlots(bag, corners.map((c) => `spring_${c}`));
  const worstTire = minSlots(bag, corners.map((c) => `wheel_${c}`));
  let pull = 0;
  if (worstArm < 34) pull += vehicle.aligned && worstArm >= 16 ? 0.25 : 0.7;
  if (worstSpring < 20) pull += vehicle.aligned ? 0.2 : 0.55;
  if (worstTire < 30) pull += 0.45;
  if (stuck) pull += 0.6;
  pull = clamp(pull, 0, 1);

  const worstBearing = minSlots(bag, corners.map((c) => `bearing_${c}`));
  const worstDisc = minSlots(bag, corners.map((c) => `brakeDisc_${c}`));
  let vibration = 0;
  if (worstBearing < 32) vibration += 0.7;
  if (worstTire < 28) vibration += 0.45;
  if (worstDisc < 24) vibration += 0.35;
  if (hub < 30) vibration += 0.25;
  vibration = clamp(vibration, 0, 1);

  let gripStat = 1;
  let wetStat = 1;
  let gripCount = 0;
  for (const c of corners) {
    const p = bag[`wheel_${c}`];
    if (!p) continue;
    gripCount += 1;
    gripStat += effectiveStat(p.stats.grip ?? 1, p.condition, 1);
    const wetBase = p.stats.wetGrip ?? (p.stats.grip && p.stats.grip > 1.15 ? 0.62 : 0.88);
    wetStat += effectiveStat(wetBase, p.condition, 1);
  }
  gripStat = gripCount ? gripStat / gripCount : 0;
  wetStat = gripCount ? wetStat / gripCount : 0;
  if (gripCount < 4) {
    gripStat = 0;
    wetStat = 0;
  }
  const grip = gripStat * (0.62 + 0.38 * suspension) * (1 - pull * 0.08);
  const wetGrip = wetStat * (0.62 + 0.38 * suspension) * (1 - pull * 0.08);

  const transIds = electric
    ? ['gearbox', 'differential', 'axles']
    : ['clutch', 'gearbox', 'flywheel', 'differential', 'axles', 'transFluid'];
  const transmission = minSlots(bag, transIds.filter((id) => id in bag)) / 100;
  const clutch = electric ? 100 : cond(bag, 'clutch');
  const gearbox = cond(bag, 'gearbox');

  const electrical = electric
    ? avg([cond(bag, 'batteryPack'), cond(bag, 'inverter'), cond(bag, 'bms'), cond(bag, 'isolation'), cond(bag, 'wiring'), cond(bag, 'ecu')]) / 100
    : avg([cond(bag, 'battery'), cond(bag, 'alternator'), cond(bag, 'wiring'), cond(bag, 'ecu'), cond(bag, 'sensors')]) / 100;

  const batteryVoltage = electric
    ? 350 * (cond(bag, 'batteryPack') / 100)
    : 9.4 + 3.4 * soft(cond(bag, 'battery'), 0, 70);
  const chargingVoltage = electric
    ? cond(bag, 'chargePort') < 20 || cond(bag, 'bms') < 20
      ? 0
      : 400
    : !vehicle.runtime.running
      ? 0
      : cond(bag, 'alternator') < 18 || cond(bag, 'belts') < 12
        ? 11.6
        : 12.4 + 2.3 * soft(minSlots(bag, ['alternator', 'belts', 'wiring']), 20, 80);

  const sensorSkew = electric ? (100 - cond(bag, 'bms')) / 100 : (100 - cond(bag, 'sensors')) / 100;

  let turboBoost = 0;
  if (turboCar) {
    const tc = cond(bag, 'turbo');
    turboBoost = tc < 12 ? 0 : (tc / 100) * (model.engine.aspiration === 'twin-turbo' ? 1.15 : 0.85);
    turboBoost *= 0.7 + 0.3 * (cond(bag, 'intercooler') / 100);
  }

  let powerMul = 1;
  let torqueMul = 1;
  for (const id of Object.keys(bag)) {
    const p = bag[id];
    if (!p) continue;
    if (p.stats.powerMul) powerMul *= effectiveStat(p.stats.powerMul, p.condition, 1);
    if (p.stats.torqueMul) torqueMul *= effectiveStat(p.stats.torqueMul, p.condition, 1);
  }
  powerMul *= 1 + vehicle.tune.ecuPower;
  torqueMul *= 1 + vehicle.tune.ecuPower * 0.9;
  if (turboCar) {
    if (!present(bag, 'turbo') || cond(bag, 'turbo') < 12) powerMul *= 0.62;
    else powerMul *= 0.85 + turboBoost * 0.35;
  }
  if (!electric && cond(bag, 'oil') < 22) powerMul *= 0.86;
  if (cond(bag, 'sensors') < 22 && !electric) powerMul *= 0.9;

  let health = 1;
  if (electric) {
    health = minSlots(bag, ['motor', 'inverter', 'batteryPack']) / 100;
  } else if (structural < 10) {
    health = 0;
  } else {
    health = (0.3 + 0.7 * (structural / 100)) * (0.35 + 0.65 * (spark / 100)) * (0.4 + 0.6 * (fuelDelivery / 100)) * (0.7 + 0.3 * (air / 100));
    health *= 0.8 + 0.2 * compressionHealth;
  }
  if (vehicle.fuel <= 0.02 && !electric) health = 0;
  if (electric && vehicle.fuel <= 0.02) health = 0;

  const powerHp = model.engine.power * health * powerMul;
  const torqueNm = model.engine.torque * health * torqueMul;

  let mass = model.mass;
  for (const spec of slotsFor(model)) {
    if (!(spec.id in vehicle.slots)) continue;
    const p = bag[spec.id];
    const baseW = spec.type === 'wheel' ? 18 : 0;
    if (!p) mass -= baseW > 0 ? baseW : 0;
    else if (spec.type === 'wheel') mass += p.weight - 18;
    else mass += Math.max(-8, p.weight * 0.02);
  }
  mass = Math.max(700, mass);

  const aero = (present(bag, 'wing') ? stat(bag, 'wing', 'aero', 0) : 0) + (present(bag, 'splitter') ? stat(bag, 'splitter', 'aero', 0) : 0) + vehicle.tune.aero * (model.body === 'supercar' || model.class === 'race' || present(bag, 'wing') ? 0.4 : 0);
  const drag = model.drag * (1 + aero * 0.08) * (1 - Math.min(0.06, vehicle.tune.ride < 0 ? -vehicle.tune.ride : 0));
  const handling =
    (0.7 + 0.3 * suspension) *
    (0.85 + 0.15 * (cond(bag, 'swayBar') / 100)) *
    (1 + (present(bag, 'steeringWheel') ? stat(bag, 'steeringWheel', 'handling', 0) : 0)) *
    (1 - Math.abs(vehicle.tune.ride) * 0.4) *
    (model.drive === 'AWD' ? 1.04 : model.drive === 'FWD' ? 0.98 : 1);

  const reliability = clamp(
    (structural / 100) * 0.4 +
      (electric ? electrical : avg([spark, fuelDelivery, cond(bag, 'oil'), cond(bag, 'belts')]) / 100) * 0.3 +
      transmission * 0.2 +
      (1 - Math.max(0, vehicle.tune.ecuPower) * 1.4) * 0.1,
    0,
    1,
  );

  const fuelMul = electric
    ? 1 + Math.max(0, vehicle.tune.ecuPower) * 0.8
    : (0.75 + 0.4 * (1 - soft(fuelDelivery, 20, 80))) * (1 + Math.max(0, vehicle.tune.ecuPower) * 1.1) * (cond(bag, 'airFilter') < 30 ? 1.15 : 1);

  const misfire = electric ? 0 : clamp((100 - spark) / 100 * 0.8 + (1 - compressionHealth) * 0.5 + (cond(bag, 'injectors') < 30 ? 0.3 : 0), 0, 1);
  const overheat = clamp(1 - cooling, 0, 1);

  let smoke: Analysis['smoke'] = 'none';
  if (!electric) {
    if (cond(bag, 'headGasket') < 22 || cond(bag, 'coolant') < 12) smoke = 'white';
    else if (cond(bag, 'pistons') < 28 || cond(bag, 'oil') < 14 || (turboCar && cond(bag, 'turbo') < 24)) smoke = 'blue';
    else if (cond(bag, 'injectors') < 25 || cond(bag, 'airFilter') < 15) smoke = 'black';
  }

  const noises: string[] = [];
  if (worstBearing < 34) noises.push('bearing');
  if (!electric && cond(bag, 'exhaust') < 30) noises.push('exhaust');
  if (!electric && cond(bag, 'belts') < 28) noises.push('belt');
  if (!electric && cond(bag, 'crankshaft') < 20) noises.push('knock');
  if (pad < 32) noises.push('brakes');
  if (turboCar && cond(bag, 'turbo') < 40 && cond(bag, 'turbo') > 8) noises.push('turbo');
  if (electric && cond(bag, 'motor') < 40) noises.push('whine');

  const reasons: L10n[] = [];
  let cranks = false;
  let fires = false;
  let chance = 0;
  if (electric) {
    const pack = cond(bag, 'batteryPack');
    const inv = cond(bag, 'inverter');
    const bms = cond(bag, 'bms');
    const iso = cond(bag, 'isolation');
    const motor = cond(bag, 'motor');
    cranks = iso >= 12 && cond(bag, 'wiring') >= 10 && cond(bag, 'ecu') >= 8;
    if (!cranks) reasons.push({ ru: 'Контактор не замыкается: изоляция, проводка или ECU.', en: 'The contactor will not close: isolation, wiring or the ECU.' });
    fires = cranks && pack >= 16 && inv >= 14 && bms >= 12 && motor >= 12 && vehicle.fuel > 0.03 && iso >= 18;
    if (cranks && pack < 16) reasons.push({ ru: 'Тяговая батарея не отдаёт напряжение.', en: 'The traction battery is not delivering voltage.' });
    if (cranks && inv < 14) reasons.push({ ru: 'Инвертор не выходит в готовность.', en: 'The inverter will not go ready.' });
    if (cranks && bms < 12) reasons.push({ ru: 'BMS блокирует включение.', en: 'The BMS is blocking enable.' });
    if (cranks && iso < 18) reasons.push({ ru: 'Утечка изоляции высокого напряжения.', en: 'High-voltage isolation is leaking.' });
    if (vehicle.fuel <= 0.03) reasons.push({ ru: 'Батарея разряжена.', en: 'The battery is empty.' });
    chance = fires ? 1 : cranks ? 0.25 : 0;
  } else {
    const batt = cond(bag, 'battery');
    const starter = cond(bag, 'starter');
    const wiring = cond(bag, 'wiring');
    const ecu = cond(bag, 'ecu');
    const pump = cond(bag, 'fuelPump');
    cranks = batt >= 14 && starter >= 16 && wiring >= 12 && ecu >= 8;
    if (batt < 14) reasons.push({ ru: 'Аккумулятор не тянет стартер.', en: 'The battery cannot turn the starter.' });
    if (starter < 16) reasons.push({ ru: 'Стартер не развивает обороты.', en: 'The starter is not reaching speed.' });
    if (wiring < 12) reasons.push({ ru: 'Просадка в проводке на пуске.', en: 'The harness drops voltage while cranking.' });
    if (ecu < 8) reasons.push({ ru: 'ECU не разрешает пуск.', en: 'The ECU will not authorize a start.' });
    const fuelOk = pump >= 16 && cond(bag, 'fuelLines') >= 12 && vehicle.fuel > 0.04 && cond(bag, 'fuelTank') >= 8;
    const sparkOk = diesel || spark >= 18;
    const compOk = compressionHealth >= 0.38 && structural >= 12;
    fires = cranks && fuelOk && sparkOk && compOk && cond(bag, 'sensors') >= 6;
    if (cranks && !fuelOk) reasons.push({ ru: 'Топливо не доходит до мотора.', en: 'Fuel is not reaching the engine.' });
    if (cranks && !sparkOk) reasons.push({ ru: 'Нет устойчивой искры.', en: 'There is no stable spark.' });
    if (cranks && !compOk) reasons.push({ ru: 'Компрессии недостаточно, чтобы схватить.', en: 'Compression is too low to catch.' });
    if (cranks && cond(bag, 'sensors') < 6) reasons.push({ ru: 'Опорный датчик не даёт синхронизацию.', en: 'The reference sensor is not syncing.' });
    chance = fires ? clamp(0.55 + (batt / 100) * 0.2 + (spark / 100) * 0.15 + compressionHealth * 0.1, 0, 1) : cranks ? 0.2 : 0;
    if (fires) reasons.length = 0;
  }

  const missingWheel = corners.some((c) => !present(bag, `wheel_${c}`));
  const deadBox = gearbox < 10 || !present(bag, 'gearbox');
  let driveBlock: L10n | null = null;
  if (!fires) driveBlock = { ru: 'Двигатель не запускается.', en: 'The engine will not start.' };
  else if (missingWheel) driveBlock = { ru: 'Нет полного комплекта колёс.', en: 'The car does not have a full set of wheels.' };
  else if (deadBox) driveBlock = { ru: 'Коробка не передаёт момент.', en: 'The gearbox is not transmitting torque.' };
  else if (vehicle.fuel <= 0.02) driveBlock = { ru: 'Нет топлива.', en: 'No fuel.' };
  const canDrive = !driveBlock;

  const symptoms: Symptom[] = [];
  const add = (s: Symptom) => symptoms.push(s);
  if (bodyScore < 55) {
    add({ id: 'body_wear', system: 'body', severity: 1 - bodyScore / 100, text: { ru: 'На кузове видны вмятины, сколы или ржавчина.', en: 'The body shows dents, chips or rust.' }, sources: ['visual'] });
  }
  if (vehicle.paintCondition < 50) {
    add({ id: 'paint_fade', system: 'body', severity: 1 - vehicle.paintCondition / 100, text: { ru: 'Лак мутный, цвет выгорел.', en: 'The clear is dull and the colour is faded.' }, sources: ['visual'] });
  }
  if (vehicle.dirt > 40) {
    add({ id: 'dirty', system: 'body', severity: vehicle.dirt / 100, text: { ru: 'Машина грязная, часть дефектов скрыта слоем пыли.', en: 'The car is dirty. Some defects are hidden under dust.' }, sources: ['visual'] });
  }
  if (lightsScore < 50) {
    add({ id: 'lights', system: 'electrical', severity: 1 - lightsScore / 100, text: { ru: 'Часть оптики мутная, треснутая или не горит.', en: 'Some lamps are cloudy, cracked or dead.' }, sources: ['visual'] });
  }
  if (!electric && (cond(bag, 'oilPan') < 40 || cond(bag, 'valveCover') < 35)) {
    add({ id: 'oil_leak', system: 'engine', severity: 0.6, text: { ru: 'Подтёки масла на двигателе или поддоне.', en: 'Oil wetness on the engine or the sump.' }, sources: ['visual'] });
  }
  if (!electric && (cond(bag, 'radiator') < 35 || cond(bag, 'coolant') < 30 || cond(bag, 'headGasket') < 30)) {
    add({ id: 'coolant_leak', system: 'cooling', severity: 0.7, text: { ru: 'Следы охлаждающей жидкости или сладковатый налёт.', en: 'Coolant traces or a sweet crust.' }, sources: ['visual'] });
  }
  if (worstTire < 40) {
    add({ id: 'tires', system: 'tires', severity: 0.6, text: { ru: 'Резина изношена неравномерно.', en: 'The tires are worn unevenly.' }, sources: ['visual'] });
  }
  if (interiorScore < 45 || (vehicle.trueOdometer > vehicle.odometer * 1.35 && interiorScore < 70)) {
    add({
      id: 'interior_wear',
      system: 'interior',
      severity: 0.5,
      text: vehicle.trueOdometer > vehicle.odometer * 1.35
        ? { ru: 'Салон и педали изношены сильнее, чем обещает одометр.', en: 'The cabin and pedals are more worn than the odometer claims.' }
        : { ru: 'Салон устал: сиденья и руль с большим пробегом.', en: 'The cabin is tired: seats and the wheel have high mileage.' },
      sources: ['visual', 'history'],
    });
  }
  if (noises.includes('bearing')) add({ id: 'noise_bearing', system: 'suspension', severity: vibration, text: { ru: 'Гул, растущий со скоростью. Похоже на подшипник.', en: 'A hum that grows with speed. It sounds like a bearing.' }, sources: ['sound', 'testdrive'] });
  if (noises.includes('exhaust')) add({ id: 'noise_exhaust', system: 'engine', severity: 0.5, text: { ru: 'Шипение или рык в районе выхлопа.', en: 'A hiss or bark around the exhaust.' }, sources: ['sound'] });
  if (noises.includes('belt')) add({ id: 'noise_belt', system: 'engine', severity: 0.45, text: { ru: 'Свист ремня на холодную и при включении потребителей.', en: 'A belt squeal when cold and when accessories come on.' }, sources: ['sound', 'idle'] });
  if (noises.includes('knock')) add({ id: 'noise_knock', system: 'engine', severity: 0.8, text: { ru: 'Глухой стук снизу мотора под газом.', en: 'A dull knock from the bottom of the engine under throttle.' }, sources: ['sound', 'idle'] });
  if (noises.includes('brakes')) add({ id: 'noise_brakes', system: 'brakes', severity: 0.5, text: { ru: 'Скрип тормозов.', en: 'Brake squeal.' }, sources: ['sound', 'testdrive'] });
  if (noises.includes('turbo')) add({ id: 'noise_turbo', system: 'engine', severity: 0.55, text: { ru: 'Посторонний свист турбины, не похожий на нормальный наддув.', en: 'An abnormal turbo whistle, not a healthy spool.' }, sources: ['sound', 'idle'] });
  if (misfire > 0.35) add({ id: 'misfire', system: 'engine', severity: misfire, text: { ru: 'Неровная работа, пропуски вспышек.', en: 'Uneven running, missed fires.' }, sources: ['idle', 'sound', 'testdrive'] });
  if (!fires && cranks) add({ id: 'crank_no_start', system: 'engine', severity: 0.8, text: { ru: 'Стартер крутит, мотор не схватывает.', en: 'The starter turns, the engine does not catch.' }, sources: ['idle', 'sound'] });
  if (!cranks) add({ id: 'no_crank', system: 'electrical', severity: 0.9, text: { ru: 'Пуск вялый или стартер молчит.', en: 'Cranking is weak, or the starter is silent.' }, sources: ['idle', 'sound'] });
  if (overheat > 0.45) add({ id: 'overheat', system: 'cooling', severity: overheat, text: { ru: 'Температура быстро растёт под нагрузкой.', en: 'Temperature climbs quickly under load.' }, sources: ['idle', 'testdrive'] });
  if (pull > 0.35) add({ id: 'pull', system: 'suspension', severity: pull, text: { ru: 'Машину уводит в сторону.', en: 'The car pulls to one side.' }, sources: ['testdrive', 'visual'] });
  if (vibration > 0.35) add({ id: 'vibration', system: 'suspension', severity: vibration, text: { ru: 'Вибрация на скорости.', en: 'Vibration at speed.' }, sources: ['testdrive', 'sound'] });
  if (brake < 0.62) add({ id: 'brake_weak', system: 'brakes', severity: 1 - brake, text: { ru: 'Тормозной путь длинный, педаль не внушает доверия.', en: 'The stopping distance is long and the pedal is untrustworthy.' }, sources: ['testdrive'] });
  if (smoke !== 'none') {
    const text = smoke === 'white'
      ? { ru: 'Белый дым, похожий на уход антифриза.', en: 'White smoke, like coolant being burned.' }
      : smoke === 'blue'
        ? { ru: 'Сизый дым, масло в камере или в турбине.', en: 'Blue smoke, oil in the chamber or the turbo.' }
        : { ru: 'Чёрный дым, смесь слишком богатая.', en: 'Black smoke, the mixture is too rich.' };
    add({ id: `smoke_${smoke}`, system: smoke === 'white' ? 'cooling' : 'engine', severity: 0.7, text, sources: ['idle', 'visual'] });
  }
  if (clutch < 28 && !electric) add({ id: 'slip', system: 'transmission', severity: 0.6, text: { ru: 'Обороты растут быстрее скорости. Сцепление буксует.', en: 'Rpm rises faster than speed. The clutch is slipping.' }, sources: ['testdrive'] });
  if (gearbox < 35) add({ id: 'gear_bad', system: 'transmission', severity: 0.7, text: { ru: 'Передачи включаются плохо или с хрустом.', en: 'Gears engage poorly or with a crunch.' }, sources: ['testdrive', 'sound'] });

  const codes: EcuCode[] = [];
  if (!electric && batteryVoltage < 12.1) codes.push({ id: 'P0562', system: 'electrical', text: { ru: 'P0562 Низкое напряжение системы', en: 'P0562 System voltage low' } });
  if (!electric && chargingVoltage > 0 && chargingVoltage < 13.2) codes.push({ id: 'P0622', system: 'electrical', text: { ru: 'P0622 Цепь генератора', en: 'P0622 Generator field circuit' } });
  if (misfire > 0.3) codes.push({ id: 'P0300', system: 'engine', text: { ru: 'P0300 Случайные пропуски зажигания', en: 'P0300 Random misfire' } });
  if (!electric && fuelDelivery < 40) codes.push({ id: 'P0171', system: 'fuel', text: { ru: 'P0171 Смесь слишком бедная', en: 'P0171 System too lean' } });
  if (overheat > 0.4) codes.push({ id: 'P0217', system: 'cooling', text: { ru: 'P0217 Перегрев двигателя', en: 'P0217 Engine overheat' } });
  if (!electric && cond(bag, 'exhaust') < 28) codes.push({ id: 'P0420', system: 'engine', text: { ru: 'P0420 Эффективность катализатора ниже порога', en: 'P0420 Catalyst efficiency below threshold' } });
  if (worstBearing < 30) codes.push({ id: 'C0035', system: 'suspension', text: { ru: 'C0035 Датчик скорости колеса / сигнал нестабилен', en: 'C0035 Wheel speed sensor signal unstable' } });
  if (!electric && cond(bag, 'crankshaft') < 24) codes.push({ id: 'P0335', system: 'engine', text: { ru: 'P0335 Датчик коленвала', en: 'P0335 Crankshaft position sensor' } });
  if (cond(bag, 'sensors') < 30) codes.push({ id: 'P0101', system: 'electrical', text: { ru: 'P0101 Датчик расхода или давления вне диапазона', en: 'P0101 MAF or pressure sensor out of range' } });
  if (cond(bag, 'ecu') < 28) codes.push({ id: 'U0100', system: 'electrical', text: { ru: 'U0100 Потеря связи с блоком двигателя', en: 'U0100 Lost communication with the engine module' } });
  if (electric && cond(bag, 'isolation') < 40) codes.push({ id: 'P0AA6', system: 'electrical', text: { ru: 'P0AA6 Нарушение изоляции ВВ', en: 'P0AA6 HV isolation fault' } });
  if (electric && cond(bag, 'bms') < 35) codes.push({ id: 'P0A7F', system: 'electrical', text: { ru: 'P0A7F Износ или отказ батареи', en: 'P0A7F Battery deterioration' } });
  if (electric && cond(bag, 'inverter') < 35) codes.push({ id: 'P0A78', system: 'electrical', text: { ru: 'P0A78 Инвертор, ограничение момента', en: 'P0A78 Inverter torque limit' } });

  const baseComp = diesel ? 20 : 12.4;
  const compression = [0, 1, 2, 3].map((i) => {
    const bias = i === 2 && cond(bag, 'valves') < 40 ? 0.72 : i === 1 && cond(bag, 'headGasket') < 28 ? 0.8 : 1;
    return Math.round(baseComp * compressionHealth * bias * 10) / 10;
  });

  const fraudSuspected = vehicle.trueOdometer > vehicle.odometer * 1.35 && (interiorScore < 72 || bodyScore < 60);

  const systems: Record<string, number> = {
    body: bodyScore / 100,
    engine: electric ? cond(bag, 'motor') / 100 : structural / 100 * (0.5 + 0.5 * compressionHealth),
    transmission,
    suspension,
    brakes: brake,
    electrical,
    interior: interiorScore / 100,
    tires: tireScore / 100,
    cooling,
    fuel: electric ? vehicle.fuel : fuelDelivery / 100,
  };

  return {
    parts: partInfo,
    systems,
    symptoms,
    codes,
    start: { cranks, fires, chance, reasons },
    powerHp,
    torqueNm,
    mass,
    grip,
    wetGrip,
    brake,
    cooling,
    fuelMul,
    reliability,
    handling,
    aero,
    drag,
    electrical,
    misfire,
    overheat,
    pull,
    vibration,
    smoke,
    noises,
    canDrive,
    driveBlock,
    fraudSuspected,
    bodyScore,
    paintScore: vehicle.paintCondition,
    interiorScore,
    tireScore,
    lightsScore,
    compression,
    batteryVoltage,
    chargingVoltage,
    sensorSkew,
    turboBoost,
    electric,
    diesel,
  };
}

export function systemKnowledge(
  vehicle: VehicleInstance,
  system: string,
  deep: boolean,
): 'unknown' | 'suspected' | 'known' {
  if (deep && vehicle.deepScanned) return 'known';
  const modelSlots = Object.keys(vehicle.slots);
  const relevant = modelSlots.filter((id) => {
    const info = id;
    return info.includes(system) || system === 'body' && /hood|door|fender|bumper|roof|trunk|windshield|mirror|wing|splitter/.test(id)
      || system === 'engine' && /engine|piston|crank|cam|valve|spark|injector|intake|turbo|exhaust|oil|belt|head|motor/.test(id)
      || system === 'brakes' && /brake|caliper|wheel/.test(id)
      || system === 'suspension' && /shock|spring|arm|sway|hub|bearing/.test(id)
      || system === 'electrical' && /battery|alternator|starter|ecu|wiring|sensor|inverter|bms|isolation|charge|headlight|taillight/.test(id)
      || system === 'transmission' && /clutch|gear|flywheel|diff|axle|transFluid/.test(id)
      || system === 'cooling' && /radiator|water|thermo|coolant|fan|intercooler/.test(id)
      || system === 'fuel' && /fuel/.test(id)
      || system === 'interior' && /seat|dashboard|steering/.test(id)
      || system === 'tires' && /wheel_/.test(id);
  });
  if (relevant.length && relevant.every((id) => vehicle.inspected.includes(id) || vehicle.slots[id] == null && vehicle.inspected.includes(id))) {
    return 'known';
  }
  if (vehicle.clues.some((c) => c.system === system) || vehicle.suspected.includes(system)) return 'suspected';
  if (relevant.some((id) => vehicle.inspected.includes(id))) return 'suspected';
  return 'unknown';
}

export type Symptomish = Symptom;
