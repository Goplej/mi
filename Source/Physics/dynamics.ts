import type { ModelDef, WeatherKind } from '../Core/types';
import type { Analysis } from '../Vehicles/analysis';
import { finalDriveOf, gearsOf, wheelRadiusOf } from '../Vehicles/models';

export interface Powertrain {
  powerHp: number;
  torqueNm: number;
  redline: number;
  idle: number;
  gears: number[];
  finalDrive: number;
  wheelRadius: number;
  mass: number;
  grip: number;
  wetGrip: number;
  brakeN: number;
  drag: number;
  area: number;
  cooling: number;
  fuelMul: number;
  handling: number;
  drive: ModelDef['drive'];
  electric: boolean;
  reliability: number;
  wheelbase: number;
  ride: number;
  aero: number;
  misfire: number;
  slip: number;
}

export interface Body {
  x: number;
  y: number;
  heading: number;
  speed: number;
  rpm: number;
  gear: number;
  temp: number;
  fuel: number;
  distance: number;
  lateral: number;
  broken: '' | 'limp' | 'stop';
  brakeWear: number;
  tireWear: number;
  heatDamage: number;
}

export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
}

export interface DriveEnv {
  mu: number;
  ambient: number;
  surface: 'asphalt' | 'wet' | 'dirt' | 'snow' | 'runoff';
}

export function weatherMu(kind: WeatherKind): number {
  if (kind === 'rain') return 0.74;
  if (kind === 'heavy-rain') return 0.56;
  if (kind === 'snow') return 0.42;
  if (kind === 'fog') return 0.92;
  return 1;
}

export function surfaceMu(surface: DriveEnv['surface']): number {
  if (surface === 'wet') return 0.78;
  if (surface === 'dirt') return 0.62;
  if (surface === 'snow') return 0.4;
  if (surface === 'runoff') return 0.48;
  return 1;
}

export function buildPowertrain(model: ModelDef, analysis: Analysis, ride = 0): Powertrain {
  return {
    powerHp: analysis.powerHp,
    torqueNm: analysis.torqueNm,
    redline: model.engine.redline,
    idle: model.engine.idle || 800,
    gears: gearsOf(model),
    finalDrive: finalDriveOf(model),
    wheelRadius: wheelRadiusOf(model),
    mass: analysis.mass,
    grip: analysis.grip,
    wetGrip: analysis.wetGrip,
    brakeN: model.brakeForce * analysis.brake,
    drag: analysis.drag,
    area: model.width * model.height * 0.82,
    cooling: analysis.cooling,
    fuelMul: analysis.fuelMul,
    handling: analysis.handling,
    drive: model.drive,
    electric: analysis.electric,
    reliability: analysis.reliability,
    wheelbase: model.wheelbase,
    ride,
    aero: analysis.aero,
    misfire: analysis.misfire,
    slip: analysis.systems.transmission < 0.35 ? 0.35 : analysis.systems.transmission < 0.55 ? 0.12 : 0,
  };
}

export function torqueAtRpm(pt: Powertrain, rpm: number, throttle: number): number {
  const idle = pt.electric ? 0 : pt.idle;
  const red = pt.redline;
  const x = (rpm - idle) / Math.max(1, red - idle);
  let shape = pt.electric ? 1 - Math.max(0, x - 0.15) * 0.55 : Math.sin(Math.min(1, Math.max(0, x)) * Math.PI) * 0.55 + 0.45;
  if (!pt.electric && x < 0.08) shape *= 0.75;
  if (!pt.electric && rpm > red) shape *= 0.2;
  const misfire = pt.misfire > 0.4 && Math.sin(rpm * 0.02) > 0.4 ? 0.65 : 1;
  return pt.torqueNm * shape * throttle * misfire * (1 - pt.slip);
}

export function createBody(fuel: number, temp = 22): Body {
  return {
    x: 0,
    y: 2,
    heading: 0,
    speed: 0,
    rpm: 0,
    gear: 1,
    temp,
    fuel,
    distance: 0,
    lateral: 0,
    broken: '',
    brakeWear: 0,
    tireWear: 0,
    heatDamage: 0,
  };
}

export function stepVehicle(body: Body, input: DriveInput, pt: Powertrain, env: DriveEnv, dt: number): void {
  const h = Math.min(0.05, Math.max(0.001, dt));
  if (body.broken === 'stop' || body.fuel <= 0) {
    body.speed *= Math.max(0, 1 - h * 1.5);
    body.rpm = pt.electric ? 0 : pt.idle;
    return;
  }
  const limp = body.broken === 'limp' ? 0.22 : 1;
  const ratio = pt.gears[Math.max(0, body.gear - 1)] * pt.finalDrive;
  const wheelOmega = Math.abs(body.speed) / pt.wheelRadius;
  let rpm = pt.electric ? wheelOmega * ratio * 9.2 : (wheelOmega * ratio * 60) / (2 * Math.PI);
  if (!pt.electric) rpm = Math.max(pt.idle, rpm);
  body.rpm = rpm;

  if (!pt.electric && pt.gears.length > 1) {
    if (rpm > pt.redline * 0.92 && body.gear < pt.gears.length) body.gear += 1;
    if (rpm < pt.redline * 0.32 && body.gear > 1 && input.throttle < 0.4) body.gear -= 1;
  }

  const tq = torqueAtRpm(pt, rpm, input.throttle) * limp;
  const driveForce = (tq * ratio * 0.9) / pt.wheelRadius;
  const surface = surfaceMu(env.surface) * env.mu;
  const tireMu = (env.surface === 'wet' || env.surface === 'snow' ? pt.wetGrip : pt.grip) * surface;
  const clearancePenalty = env.surface === 'dirt' && pt.ride < -0.03 ? 0.75 : 1;
  const maxTraction = pt.mass * 9.81 * Math.max(0.15, tireMu) * clearancePenalty * (pt.drive === 'AWD' ? 1.12 : pt.drive === 'FWD' ? 0.96 : 1);
  const limitedDrive = Math.max(-maxTraction, Math.min(maxTraction, driveForce));
  const v = body.speed;
  const drag = 0.5 * 1.2 * pt.drag * pt.area * v * Math.abs(v);
  const roll = 0.015 * pt.mass * 9.81 * Math.sign(v || 1);
  const brake = input.brake * pt.brakeN * (0.55 + 0.45 * tireMu) + input.handbrake * pt.brakeN * 0.45;
  let force = limitedDrive - drag - roll;
  if (v > 0.2) force -= brake;
  else if (v < -0.2) force += brake;
  else force -= Math.sign(force) * Math.min(Math.abs(force), brake);
  const accel = force / pt.mass;
  body.speed += accel * h;
  if (input.brake > 0.2 && Math.abs(body.speed) < 0.4 && input.throttle < 0.1) body.speed = 0;

  const steer = input.steer * (0.42 / (1 + Math.abs(body.speed) * 0.045)) * pt.handling;
  const yaw = body.speed * Math.tan(steer) / Math.max(1.8, pt.wheelbase);
  const lat = Math.abs(yaw * body.speed);
  const maxLat = 9.81 * Math.max(0.2, tireMu) * (1 + pt.aero * Math.min(0.3, Math.abs(body.speed) / 80));
  body.lateral = lat / 9.81;
  const over = lat > maxLat ? maxLat / Math.max(0.1, lat) : 1;
  const oversteer = pt.drive === 'RWD' && input.throttle > 0.7 && tireMu < 0.85 ? 1.12 : 1;
  body.heading += yaw * over * oversteer * h;
  body.x += Math.sin(body.heading) * body.speed * h;
  body.y += Math.cos(body.heading) * body.speed * h;
  body.distance += Math.abs(body.speed) * h;

  const load = input.throttle * (pt.powerHp / 200);
  const cool = pt.cooling * (0.35 + Math.abs(body.speed) * 0.01) * (env.ambient < 5 ? 1.2 : 1);
  body.temp += (load * 18 - cool * (body.temp - env.ambient) * 0.35) * h;
  body.temp = Math.max(env.ambient, body.temp);
  if (body.temp > 108) {
    body.heatDamage += h * (body.temp - 108) * 0.02;
  }
  const litresPerSec = pt.electric
    ? (pt.powerHp * input.throttle * 0.0008) / 100
    : (0.00035 + input.throttle * 0.0016) * pt.fuelMul * (pt.powerHp / 120);
  body.fuel = Math.max(0, body.fuel - (litresPerSec * h) / Math.max(30, 50));
  body.brakeWear += input.brake * Math.abs(body.speed) * h * 0.0004;
  body.tireWear += (Math.abs(body.speed) * h * 0.00002) * (1 + input.handbrake + Math.max(0, lat / maxLat - 0.8));
  if (body.fuel <= 0) body.broken = 'stop';
}

export interface SprintResult {
  zeroTo100: number | null;
  quarter: number | null;
  top: number;
  brake100: number | null;
}

export function simulateSprint(pt: Powertrain, weather: WeatherKind): SprintResult {
  const body = createBody(0.8, 20);
  const env: DriveEnv = { mu: weatherMu(weather), ambient: 18, surface: weather === 'snow' ? 'snow' : weather === 'rain' || weather === 'heavy-rain' ? 'wet' : 'asphalt' };
  let t = 0;
  let zero: number | null = null;
  let quarter: number | null = null;
  let top = 0;
  const dt = 0.05;
  while (t < 40 && body.distance < 450) {
    stepVehicle(body, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }, pt, env, dt);
    t += dt;
    const kmh = body.speed * 3.6;
    if (kmh > top) top = kmh;
    if (zero == null && kmh >= 100) zero = t;
    if (quarter == null && body.distance >= 402) quarter = t;
  }
  const brakeFrom = createBody(0.8, 20);
  brakeFrom.speed = 100 / 3.6;
  brakeFrom.gear = Math.min(3, pt.gears.length);
  let dist = 0;
  let bt = 0;
  while (bt < 20 && brakeFrom.speed > 0.4) {
    const before = brakeFrom.speed;
    stepVehicle(brakeFrom, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }, pt, env, dt);
    dist += Math.abs(before) * dt;
    bt += dt;
  }
  return {
    zeroTo100: zero,
    quarter,
    top,
    brake100: brakeFrom.speed < 1 ? dist : null,
  };
}
