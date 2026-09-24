import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/latin-700.css';
import './UI/styles.css';
import type { Lang, Settings } from './Core/types';
import { tr } from './Core/util';
import { AudioBus } from './Audio/audio';
import { Game, actions, runCommand } from './Game/game';
import type { NewGameOptions } from './Game/newGame';
import { buildPowertrain, createBody, stepVehicle, weatherMu, type DriveEnv } from './Physics/dynamics';
import { View } from './Render/view';
import { loadSettings, readSlot, storeSettings, writeSlot, deleteSlot, latestSlot } from './SaveSystem/save';
import { Shell } from './UI/shell';
import { freshSession, type Session } from './UI/session';
import { modelById } from './Vehicles/models';
import { ambientTemp } from './Weather/weather';
import { cityBuildings, poiAt, travelMinutes } from './World/city';

const keys = new Set<string>();
let settings: Settings = loadSettings();
let game: Game | null = null;
let session: Session = freshSession();
const audio = new AudioBus();
let lastSave = 0;
let lastFrame = 0;
let running = true;

const shell = new Shell(
  document.querySelector('#app')!,
  () => ({ game, session, lang: currentLang() }),
  (cmd, args) => handle(cmd, args),
);
const view = new View(shell.canvas(), (id) => {
  session.selectedId = id;
  session.panel = session.panel ?? 'car';
  if (session.mode === 'garage') session.panel = 'car';
  shell.render();
});
view.setQuality(settings.quality);
window.addEventListener('resize', () => view.resize());
window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
window.addEventListener('keydown', (ev) => onKey(ev, true));
window.addEventListener('keyup', (ev) => onKey(ev, false));

shell.render();
requestAnimationFrame(frame);

function currentLang(): Lang {
  return game?.state.settings.lang ?? settings.lang;
}

function frame(t: number): void {
  if (!running) return;
  const dt = Math.min(0.05, lastFrame ? (t - lastFrame) / 1000 : 0.016);
  lastFrame = t;
  applyHeldKeys();
  if (game && session.mode !== 'menu') {
    const driving = !!session.drive;
    if (driving && !session.pausedMenu) stepDrive(dt);
    if (!session.pausedMenu) game.update(dt, driving);
    if (game.state.settings.autosave && t - lastSave > 45000 && session.mode === 'garage') {
      try {
        writeSlot(0, game.state);
        lastSave = t;
      } catch {
        /* storage full */
      }
    }
  }
  const driveView = session.drive
    ? {
        x: session.drive.body.x,
        z: session.drive.body.y,
        heading: session.drive.body.heading,
        steer: session.steer * 0.35,
        speed: session.drive.body.speed,
        lights: session.drive.lights,
      }
    : null;
  view.sync(game?.state ?? null, { mode: session.mode, selectedId: session.selectedId, drive: driveView });
  view.update();
  syncAudio();
  shell.tick();
  requestAnimationFrame(frame);
}

function handle(cmd: string, args: unknown[]): void {
  audio.unlock();
  if (cmd === 'menu') {
    const next = String(args[0] ?? 'main');
    if (next === 'continue') return continueGame();
    if (next === 'exit') return quit();
    session.menu = next as Session['menu'];
    shell.render();
    return;
  }
  if (cmd === 'start-new') return startNew();
  if (cmd === 'load-slot') return loadSlot(Number(args[0]));
  if (cmd === 'delete-slot') {
    deleteSlot(Number(args[0]));
    shell.render();
    return;
  }
  if (cmd === 'setting') return applySetting(String(args[0]), args[1]);
  if (cmd === 'to-menu') return toMenu();
  if (cmd === 'exit') return quit();
  if (cmd === 'resume') {
    session.pausedMenu = false;
    shell.render();
    return;
  }
  if (cmd === 'pause-menu') {
    session.pausedMenu = !session.pausedMenu;
    shell.render();
    return;
  }
  if (cmd === 'pause-nav') {
    session.pausedMenu = false;
    session.panel = String(args[0]);
    session.mode = 'garage';
    shell.render();
    return;
  }
  if (!game) return;
  if (cmd === 'save-slot') {
    writeSlot(Number(args[0] ?? 1), game.state);
    toast(say('Записано.', 'Saved.'), 'good');
    return;
  }
  if (cmd === 'open-panel') {
    session.panel = String(args[0]);
    session.pausedMenu = false;
    shell.render();
    return;
  }
  if (cmd === 'close-panel') {
    session.panel = null;
    shell.render();
    return;
  }
  if (cmd === 'select-car') {
    session.selectedId = String(args[0]);
    session.panel = 'car';
    shell.render();
    return;
  }
  if (cmd === 'select-slot') {
    session.selectedSlot = String(args[0]);
    shell.render();
    return;
  }
  if (cmd === 'set-group') {
    session.group = String(args[0]);
    shell.render();
    return;
  }
  if (cmd === 'focus-slot') {
    session.selectedId = String(args[0]);
    session.selectedSlot = String(args[1]);
    session.group = String(args[2] ?? 'all');
    session.panel = 'car';
    shell.render();
    return;
  }
  if (cmd === 'open-order') {
    session.selectedSlot = String(args[0]);
    session.panel = 'car';
    shell.render();
    return;
  }
  if (cmd === 'speed') {
    game.setSpeed(Number(args[0]));
    shell.render();
    return;
  }
  if (cmd === 'wait-morning') {
    game.waitUntilMorning();
    noteFresh();
    shell.render();
    return;
  }
  if (cmd === 'skip-work') {
    const w = game.state.work.active;
    if (w) game.advance(w.remaining + 0.4);
    noteFresh();
    shell.render();
    return;
  }
  if (cmd === 'wait-delivery') {
    const eta = game.state.garage.deliveries.reduce((m, d) => Math.min(m, d.eta), Infinity);
    if (!Number.isFinite(eta)) toast(say('Поставок нет.', 'Nothing is inbound.'), 'warn');
    else game.advance(Math.max(1, eta - game.state.clock.absolute + 1));
    noteFresh();
    shell.render();
    return;
  }
  if (cmd === 'advance-day') {
    game.advance(20 * 60);
    noteFresh();
    shell.render();
    return;
  }
  if (cmd === 'advance-hours') {
    game.advance(Number(args[0]) * 60);
    noteFresh();
    shell.render();
    return;
  }
  if (cmd === 'start-drive') return beginDrive(args[0] === 'city' ? 'city' : 'track');
  if (cmd === 'exit-drive') {
    endDrive();
    shell.render();
    return;
  }
  if (cmd === 'toggle-lights') {
    if (session.drive) session.drive.lights = !session.drive.lights;
    return;
  }
  if (cmd === 'travel') return travelTo(String(args[0]));
  if (cmd === 'arrive') return arrive(String(args[0]));
  const result = runCommand(game, cmd, ...args) as { ok?: boolean; message?: { ru: string; en: string } } | void;
  if (result && typeof result === 'object') {
    if (result.message) toast(tr(result.message, currentLang()), result.ok === false ? 'bad' : 'good');
    else noteFresh();
    if (result.ok === false) audio.deny();
    else audio.confirm();
  }
  shell.render();
}

function startNew(): void {
  const name = (document.querySelector('#co-name') as HTMLInputElement | null)?.value?.trim() || 'Bay One';
  const boss = (document.querySelector('#co-boss') as HTMLInputElement | null)?.value?.trim() || 'Alex';
  const difficulty = ((document.querySelector('#co-diff') as HTMLSelectElement | null)?.value ?? 'normal') as NewGameOptions['difficulty'];
  const lang = ((document.querySelector('#co-lang') as HTMLSelectElement | null)?.value ?? settings.lang) as Lang;
  const seed = Number((document.querySelector('#co-seed') as HTMLInputElement | null)?.value ?? 0);
  game = Game.create({ company: name.slice(0, 28), boss: boss.slice(0, 28), difficulty, lang, seed });
  settings = { ...game.state.settings };
  storeSettings(settings);
  enter(game);
  audio.confirm();
}

function continueGame(): void {
  const slot = latestSlot();
  if (slot == null) {
    session.menu = 'main';
    shell.render();
    return;
  }
  loadSlot(slot);
}

function loadSlot(slot: number): void {
  try {
    const state = readSlot(slot);
    if (!state) {
      toast(say('Слот пуст.', 'That slot is empty.'), 'warn');
      return;
    }
    game = Game.fromSave(state);
    settings = { ...game.state.settings };
    storeSettings(settings);
    enter(game);
  } catch {
    toast(say('Сохранение не читается.', 'That save cannot be read.'), 'bad');
    audio.deny();
  }
}

function enter(next: Game): void {
  game = next;
  session = freshSession();
  session.mode = 'garage';
  session.panel = 'workshop';
  const owned = next.state.vehicles.find((v) => v.role === 'owned' && v.location !== 'offsite');
  session.selectedId = owned?.id ?? next.state.vehicles[0]?.id ?? null;
  view.setQuality(next.state.settings.quality);
  audio.apply(next.state.settings);
  lastSave = performance.now();
  shell.render();
}

function toMenu(): void {
  if (session.drive) endDrive();
  if (game?.state.settings.autosave) {
    try {
      writeSlot(0, game.state);
    } catch {
      /* ignore */
    }
  }
  session.mode = 'menu';
  session.menu = 'main';
  session.pausedMenu = false;
  session.drive = null;
  shell.render();
}

function quit(): void {
  if (game) {
    try {
      writeSlot(0, game.state);
    } catch {
      /* ignore */
    }
  }
  session.mode = 'menu';
  session.menu = 'exit';
  running = false;
  shell.render();
  const bridge = (window as unknown as { garageEmpire?: { quit?: () => void } }).garageEmpire;
  bridge?.quit?.();
  window.close();
}

function applySetting(key: string, value: unknown): void {
  const patch: Partial<Settings> = {};
  if (key === 'lang') patch.lang = value === 'en' ? 'en' : 'ru';
  else if (key === 'quality') patch.quality = value === 'low' || value === 'high' ? value : 'medium';
  else if (key === 'master' || key === 'engineVol' || key === 'ambience' || key === 'uiVol') patch[key] = Number(value);
  else if (key === 'autosave' || key === 'hints' || key === 'invert' || key === 'shake') patch[key] = Boolean(value);
  settings = { ...settings, ...patch };
  if (game) game.applySettings({ ...game.state.settings, ...patch });
  storeSettings(game?.state.settings ?? settings);
  audio.apply(game?.state.settings ?? settings);
  if (patch.quality) view.setQuality(patch.quality);
  if (patch.lang || key === 'autosave' || key === 'hints' || key === 'invert') shell.render();
}

function beginDrive(place: 'track' | 'city'): void {
  if (!game) return;
  const v = game.state.vehicles.find((c) => c.id === session.selectedId) ?? game.state.vehicles.find((c) => c.role === 'owned');
  if (!v) return;
  session.selectedId = v.id;
  const analysis = game.analysis(v.id);
  if (!analysis?.canDrive) {
    toast(tr(analysis?.driveBlock ?? { ru: 'Машина не едет.', en: 'The car will not move.' }, currentLang()), 'bad');
    audio.deny();
    return;
  }
  const model = modelById(v.modelId);
  const pt = buildPowertrain(model, analysis, v.tune.ride);
  const body = createBody(v.fuel, v.runtime.temp || ambientTemp(game.state));
  if (place === 'track') {
    body.x = 0;
    body.y = 8;
    body.heading = 0;
  } else {
    body.x = -24;
    body.y = 0;
    body.heading = Math.PI / 2;
  }
  const hour = Math.floor((game.state.clock.absolute % 1440) / 60);
  session.drive = {
    place,
    body,
    pt,
    t: 0,
    zero: null,
    quarter: null,
    brakeStart: null,
    brakeDist: null,
    top: 0,
    lateral: 0,
    weather: game.state.weather.kind,
    lights: v.lights || hour < 7 || hour >= 19,
    surface: 'asphalt',
  };
  session.mode = place;
  session.panel = null;
  session.pausedMenu = false;
  v.runtime.running = true;
  shell.render();
}

function endDrive(): void {
  const d = session.drive;
  if (game && d && session.selectedId) {
    actions.commitRun(game.state, session.selectedId, {
      distanceKm: d.body.distance / 1000,
      fuel: d.body.fuel,
      temp: d.body.temp,
      zeroTo100: d.place === 'track' ? d.zero : null,
      quarter: d.place === 'track' ? d.quarter : null,
      brake100: d.place === 'track' ? d.brakeDist : null,
      top: d.top,
      lateral: d.lateral,
      weather: d.weather,
      brakeWear: d.body.brakeWear,
      tireWear: d.body.tireWear,
      heat: d.body.heatDamage,
    });
  }
  const parked = game?.state.vehicles.find((c) => c.id === session.selectedId);
  if (parked) parked.lights = false;
  session.drive = null;
  session.mode = 'garage';
  session.throttle = 0;
  session.brake = 0;
  session.steer = 0;
  session.handbrake = 0;
}

function stepDrive(dt: number): void {
  const d = session.drive;
  if (!d || !game) return;
  const invert = game.state.settings.invert ? -1 : 1;
  const env = envFor(d.body.x, d.body.y, d.place);
  d.surface = env.surface;
  stepVehicle(d.body, { throttle: session.throttle, brake: session.brake, steer: session.steer * invert, handbrake: session.handbrake }, d.pt, env, dt);
  d.t += dt;
  const kmh = Math.abs(d.body.speed) * 3.6;
  if (kmh > d.top) d.top = kmh;
  if (d.body.lateral > d.lateral) d.lateral = d.body.lateral;
  if (d.zero == null && kmh >= 100) d.zero = d.t;
  if (d.quarter == null && d.body.distance >= 402.3) d.quarter = d.t;
  if (d.brakeStart == null && kmh >= 100 && session.brake > 0.55) d.brakeStart = d.body.distance;
  if (d.brakeStart != null && d.brakeDist == null && Math.abs(d.body.speed) < 0.6) d.brakeDist = Math.max(0, d.body.distance - d.brakeStart);
  if (d.place === 'city') {
    collideCity(d.body);
    session.interact = poiAt(d.body.x, d.body.y)?.id ?? null;
  } else if (Math.abs(d.body.x) > 11.2 && d.body.y > 2 && d.body.y < 198 && d.body.x < 20) {
    d.body.x = Math.sign(d.body.x) * 11.2;
    d.body.speed *= 0.45;
  }
  const v = game.state.vehicles.find((c) => c.id === session.selectedId);
  if (v) {
    v.runtime.rpm = d.body.rpm;
    v.runtime.temp = d.body.temp;
    v.runtime.throttle = session.throttle;
    v.runtime.running = d.body.fuel > 0 && d.body.broken !== 'stop';
    v.lights = d.lights;
  }
}

function envFor(x: number, z: number, place: 'track' | 'city'): DriveEnv {
  const weather = game?.state.weather.kind ?? 'clear';
  const ambient = game ? ambientTemp(game.state) : 16;
  let surface: DriveEnv['surface'] = 'asphalt';
  if (place === 'track') {
    const dirt = x > 68 && x < 90 && z > 48 && z < 92;
    const paved = (Math.abs(x) < 11 && z > -6 && z < 204) || (x > -8 && x < 86 && z > 4 && z < 76);
    if (dirt) surface = weather === 'snow' ? 'snow' : 'dirt';
    else if (!paved) surface = 'runoff';
    else if (weather === 'snow') surface = 'snow';
    else if (weather === 'rain' || weather === 'heavy-rain') surface = 'wet';
  } else {
    const road = Math.abs(z) < 8 || Math.abs(x) < 8;
    if (!road) surface = weather === 'snow' ? 'snow' : 'runoff';
    else if (weather === 'snow') surface = 'snow';
    else if (weather === 'rain' || weather === 'heavy-rain') surface = 'wet';
  }
  return { mu: weatherMu(weather), ambient, surface };
}

function collideCity(body: { x: number; y: number; speed: number }): void {
  body.x = Math.max(-190, Math.min(190, body.x));
  body.y = Math.max(-190, Math.min(190, body.y));
  for (const b of cityBuildings()) {
    const hx = b.w / 2 + 1.4;
    const hz = b.d / 2 + 1.4;
    if (Math.abs(body.x - b.x) < hx && Math.abs(body.y - b.z) < hz) {
      const dx = (body.x - b.x) / b.w;
      const dz = (body.y - b.z) / b.d;
      if (Math.abs(dx) > Math.abs(dz)) body.x = b.x + Math.sign(dx || 1) * hx;
      else body.y = b.z + Math.sign(dz || 1) * hz;
      body.speed *= 0.35;
    }
  }
}

function travelTo(poi: string): void {
  if (!game) return;
  const mins = travelMinutes('garage', poi);
  game.advance(mins);
  const v = game.state.vehicles.find((c) => c.id === session.selectedId);
  if (v) v.fuel = Math.max(0, v.fuel - mins * 0.003);
  openPoi(poi);
  toast(say(`Дорога заняла ${mins} мин.`, `The drive took ${mins} min.`), 'info');
}

function arrive(poi: string): void {
  endDrive();
  if (poi === 'track') {
    beginDrive('track');
    return;
  }
  if (poi === 'fuel' && game && session.selectedId) runCommand(game, 'refuel', session.selectedId, 'station');
  if (poi === 'wash' && game && session.selectedId) runCommand(game, 'requestWash', session.selectedId);
  if (game) game.advance(2);
  openPoi(poi);
  shell.render();
}

function openPoi(poi: string): void {
  const panel =
    poi === 'parts' ? 'parts' : poi === 'dealer' || poi === 'market' || poi === 'junk' ? 'market' : poi === 'track' ? 'workshop' : poi === 'rival' || poi === 'rival2' ? 'orders' : 'workshop';
  session.mode = 'garage';
  session.panel = panel;
  shell.render();
}

function applyHeldKeys(): void {
  if (typing()) return;
  const drive = !!session.drive && !session.pausedMenu;
  session.throttle = drive && (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
  session.brake = drive && (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
  const left = keys.has('a') || keys.has('arrowleft');
  const right = keys.has('d') || keys.has('arrowright');
  session.steer = drive ? (left ? 1 : 0) - (right ? 1 : 0) : 0;
  session.handbrake = drive && keys.has(' ') ? 1 : 0;
}

function onKey(ev: KeyboardEvent, down: boolean): void {
  if (typing()) return;
  const k = ev.key.toLowerCase();
  if (down) keys.add(k);
  else keys.delete(k);
  if (!down) return;
  if (k === ' ' && session.drive) ev.preventDefault();
  if (k === 'escape') {
    if (session.drive) {
      endDrive();
      shell.render();
    } else if (session.mode !== 'menu') {
      session.pausedMenu = !session.pausedMenu;
      shell.render();
    }
  }
  if (k === 'f' && session.drive) session.drive.lights = !session.drive.lights;
  if (k === 'e' && session.interact) arrive(session.interact);
  if (k === '1') game?.setSpeed(1);
  if (k === '2') game?.setSpeed(4);
  if (k === '3') game?.setSpeed(12);
  if (k === '0') game?.setSpeed(0);
}

function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function syncAudio(): void {
  audio.apply(game?.state.settings ?? settings);
  const wet = game?.state.weather.kind;
  audio.rain(wet === 'heavy-rain' ? 0.45 : wet === 'rain' ? 0.26 : wet === 'snow' ? 0.1 : 0);
  audio.room(session.mode === 'garage' || session.mode === 'menu');
  const v = game?.state.vehicles.find((c) => c.id === session.selectedId);
  const electric = session.drive?.pt.electric ?? (v ? modelById(v.modelId).powertrain === 'electric' : false);
  const rpm = session.drive?.body.rpm ?? v?.runtime.rpm ?? 0;
  const running = session.drive ? session.drive.body.fuel > 0 : !!v?.runtime.running;
  const throttle = session.drive ? session.throttle : v?.runtime.throttle ?? 0;
  audio.engine(rpm, throttle, running, electric);
}

function noteFresh(): void {
  const note = game?.state.notifications.find((n) => !n.read);
  if (!note) return;
  note.read = true;
  toast(tr(note.text, currentLang()), note.kind === 'bad' ? 'bad' : note.kind === 'warn' ? 'warn' : note.kind === 'good' ? 'good' : 'info');
}

function toast(text: string, kind: Session['toastKind']): void {
  session.toast = text;
  session.toastKind = kind;
  if (kind === 'bad') audio.deny();
  shell.render();
}

function say(ru: string, en: string): string {
  return currentLang() === 'en' ? en : ru;
}
