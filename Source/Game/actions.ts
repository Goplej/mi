import type { GameState, L10n, Offer, PartInstance, Quality, VehicleInstance, WorkTask } from '../Core/types';
import { RNG } from '../Core/rng';
import { clockParts, l10n, money, uid } from '../Core/util';
import { charge, creditLimit, freeCash, pay } from '../Economy/economy';
import { acceptOrder, createOffer, gradeOrder, TEMPLATES } from '../Orders/logic';
import { appraise } from '../Market/pricing';
import { longBlockQuote, quote, quotesForSlot } from '../Market/offers';
import { createPart, fitsVehicle, scrapValue } from '../VehicleParts/build';
import { LONG_BLOCK_SLOTS, partType } from '../VehicleParts/catalog';
import { analyze } from '../Vehicles/analysis';
import { slotById } from '../Vehicles/assembly';
import { modelById } from '../Vehicles/models';
import { hasCapability, toolById, upgradeById } from '../Tools/definitions';
import { gainXp, hireLimit, refreshCandidates } from '../Employees/staff';
import { accessProblem, actionMinutes, ensurePanels, inBay, liftAvailable } from './access';
import { addRep, destroyVehicle, fail, hasSpace, ok, skillGain, syncGarage, toast, type ActionResult } from './helpers';
import { createVehicle, projectPreset } from '../Vehicles/factory';

function parkingCountSafe(state: GameState): number {
  return state.garage.parking;
}

export function vehicleOf(state: GameState, id: string): VehicleInstance | null {
  return state.vehicles.find((v) => v.id === id) ?? null;
}

function analysisOf(state: GameState, v: VehicleInstance) {
  return analyze(modelById(v.modelId), v, state.parts);
}

function schedule(state: GameState, task: Omit<WorkTask, 'id' | 'remaining' | 'actor'> & { actor?: WorkTask['actor'] }): ActionResult {
  if (state.meta.bankrupt) return fail('Мастерская закрыта.', 'The shop is closed.');
  const full: WorkTask = {
    ...task,
    id: uid(state, 'job'),
    remaining: task.total,
    actor: task.actor ?? 'player',
  };
  if (full.actor === 'player') {
    if (!state.work.active) state.work.active = full;
    else state.work.queue.push(full);
  }
  return ok(full.label);
}

export function cancelCurrent(state: GameState): ActionResult {
  state.work.active = null;
  return ok(l10n('Текущая операция снята.', 'Current operation cancelled.'));
}

export function clearQueue(state: GameState): ActionResult {
  state.work.queue = [];
  return ok(l10n('Очередь очищена.', 'Queue cleared.'));
}

export function toggleHood(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  ensurePanels(v);
  v.panels.hood = !v.panels.hood;
  return ok(v.panels.hood ? l10n('Капот открыт.', 'Hood is open.') : l10n('Капот закрыт.', 'Hood is closed.'));
}

export function toggleTrunk(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  ensurePanels(v);
  v.panels.trunk = !v.panels.trunk;
  return ok(l10n('Багажник переключён.', 'Trunk toggled.'));
}

export function toggleDoor(state: GameState, id: string, door: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  ensurePanels(v);
  v.panels.doors[door] = !v.panels.doors[door];
  return ok(l10n('Дверь переключена.', 'Door toggled.'));
}

export function toggleLift(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!state.garage.upgrades.includes('lift')) return fail('Подъёмника ещё нет.', 'You do not own a lift yet.');
  if (!liftAvailable(state)) return fail('Подъёмник сломан.', 'The lift is broken.');
  if (!inBay(v)) return fail('Подъёмник работает только в боксе.', 'The lift only works in a bay.');
  ensurePanels(v);
  v.panels.lift = !v.panels.lift;
  if (v.panels.lift) v.panels.jack = null;
  return ok(v.panels.lift ? l10n('Машина поднята.', 'Car raised.') : l10n('Машина опущена.', 'Car lowered.'));
}

export function toggleJack(state: GameState, id: string, corner: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!inBay(v)) return fail('Домкрат ставят в боксе.', 'Use the jack in a bay.');
  ensurePanels(v);
  v.panels.jack = v.panels.jack === corner ? null : corner;
  if (v.panels.jack) v.panels.lift = false;
  return ok(l10n('Домкрат переставлен.', 'Jack moved.'));
}

export function requestMove(state: GameState, id: string, location: VehicleInstance['location']): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (v.role === 'market' || v.role === 'auction') return fail('Эта машина ещё не ваша.', 'This car is not yours yet.');
  if (location.startsWith('bay:')) {
    const n = Number(location.split(':')[1]);
    if (n >= state.garage.bays) return fail('Такого бокса нет.', 'That bay does not exist.');
    if (state.vehicles.some((c) => c.id !== id && c.location === location)) return fail('Бокс занят.', 'Bay occupied.');
  }
  if (location === 'parking' && state.vehicles.filter((c) => c.location === 'parking' && c.id !== id).length >= parkingCountSafe(state)) {
    return fail('Парковка заполнена.', 'Parking is full.');
  }
  if (location === 'yard' && state.vehicles.filter((c) => c.location === 'yard' && c.id !== id).length >= 2 + (state.garage.upgrades.includes('warehouse') ? 1 : 0)) {
    return fail('Во дворе нет места.', 'The yard is full.');
  }
  if (location === 'showroom' && !state.garage.upgrades.includes('showroom')) return fail('Шоурума нет.', 'No showroom.');
  return schedule(state, {
    type: 'move',
    vehicleId: id,
    extra: { location },
    total: 4,
    label: l10n('Переставить машину', 'Move the car'),
  });
}

export function requestInspect(state: GameState, id: string, slot: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const problem = accessProblem(state, v, slot, true);
  if (problem) return { ok: false, message: problem };
  if (!(slot in v.slots)) return fail('Узла нет.', 'No such part.');
  return schedule(state, {
    type: 'inspect',
    vehicleId: id,
    slot,
    total: Math.max(4, Math.round(actionMinutes(state, v, slot) * 0.35)),
    label: l10n(`Осмотр: ${slot}`, `Inspect: ${slot}`),
  });
}

export function requestRemove(state: GameState, id: string, slot: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!v.slots[slot]) return fail('Слот уже пуст.', 'The slot is already empty.');
  const problem = accessProblem(state, v, slot, true);
  if (problem) return { ok: false, message: problem };
  return schedule(state, {
    type: 'remove',
    vehicleId: id,
    slot,
    total: actionMinutes(state, v, slot),
    label: l10n(`Снятие: ${slot}`, `Remove: ${slot}`),
  });
}

export function requestInstall(state: GameState, id: string, slot: string, partUid: string): ActionResult {
  const v = vehicleOf(state, id);
  const part = state.parts[partUid];
  if (!v || !part) return fail('Нет детали или машины.', 'Missing part or car.');
  if (!state.garage.inventory.includes(partUid)) return fail('Детали нет на складе.', 'The part is not in inventory.');
  if (v.slots[slot]) return fail('Сначала снимите установленную деталь.', 'Remove the installed part first.');
  const spec = slotById(modelById(v.modelId), slot);
  if (!spec) return fail('Слот не подходит этой машине.', 'That slot does not exist on this car.');
  if (!fitsVehicle(part, spec.type, spec.size, modelById(v.modelId).brand)) {
    return fail('Деталь не совместима по размеру или марке.', 'The part does not fit this size or marque.');
  }
  const problem = accessProblem(state, v, slot, true);
  if (problem) return { ok: false, message: problem };
  return schedule(state, {
    type: 'install',
    vehicleId: id,
    slot,
    partUid,
    total: actionMinutes(state, v, slot),
    label: l10n(`Установка: ${slot}`, `Install: ${slot}`),
  });
}

export function requestRepair(state: GameState, id: string, slot: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const uidPart = v.slots[slot];
  if (!uidPart || !state.parts[uidPart]) return fail('В слоте пусто — чинить нечего.', 'The slot is empty.');
  const part = state.parts[uidPart];
  if (part.consumable || !part.repairable) return fail('Эту деталь только меняют.', 'This part can only be replaced.');
  const spec = slotById(modelById(v.modelId), slot);
  if (spec?.system === 'body' && !state.garage.tools.includes('welder') && !state.garage.upgrades.includes('bodyShop')) {
    return fail('Нужен сварочный аппарат.', 'A welder is required.');
  }
  const problem = accessProblem(state, v, slot, true);
  if (problem) return { ok: false, message: problem };
  const cost = Math.round(partType(part.type).basePrice * 0.16 * (1 - part.condition / 100) + 20);
  if (freeCash(state) < cost) return fail('Не хватает денег на материалы.', 'Not enough cash for materials.');
  return schedule(state, {
    type: 'repair',
    vehicleId: id,
    slot,
    extra: { cost },
    total: Math.round(actionMinutes(state, v, slot) * 0.8),
    label: l10n(`Ремонт: ${slot}`, `Repair: ${slot}`),
  });
}

export function requestDiag(state: GameState, id: string, kind: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (kind !== 'visual' && !inBay(v) && kind !== 'listen') return fail('Для этой проверки машина должна стоять в боксе.', 'This test needs the car in a bay.');
  if (kind === 'scan' && !hasCapability(state.garage.tools, state.garage.upgrades, 'scanner')) return fail('Нет сканера.', 'No scanner.');
  if (kind === 'meter' && !hasCapability(state.garage.tools, state.garage.upgrades, 'multimeter')) return fail('Нет мультиметра.', 'No multimeter.');
  if (kind === 'compression') {
    if (modelById(v.modelId).powertrain === 'electric') return fail('У электромобиля нет компрессии.', 'An EV has no compression.');
    if (!hasCapability(state.garage.tools, state.garage.upgrades, 'compression')) return fail('Нужен компрессометр, центр или моторный цех.', 'Need a gauge, the center or the engine shop.');
    if (v.slots.sparkPlugs) return fail('Сначала снимите свечи.', 'Remove the spark plugs first.');
  }
  if (kind === 'idle' && !v.runtime.running) return fail('Сначала запустите двигатель.', 'Start the engine first.');
  const totals: Record<string, number> = { visual: 12, listen: 6, scan: 18, meter: 10, compression: 22, idle: 10 };
  return schedule(state, {
    type: kind,
    vehicleId: id,
    total: totals[kind] ?? 10,
    label: l10n(`Диагностика: ${kind}`, `Diagnostics: ${kind}`),
  });
}

export function orderPart(state: GameState, vehicleId: string, slot: string, quality: Quality, rush: boolean): ActionResult {
  const v = vehicleOf(state, vehicleId);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const spec = slotById(modelById(v.modelId), slot);
  if (!spec) return fail('Слот не найден.', 'Slot not found.');
  const offer = quotesForSlot(state, v, slot).find((o) => o.quality === quality);
  if (!offer) return fail('Такое качество сейчас не заказать.', 'That quality cannot be ordered right now.');
  return placeOrder(state, offer, rush, true);
}

export function orderLongBlock(state: GameState, vehicleId: string, rush: boolean): ActionResult {
  const v = vehicleOf(state, vehicleId);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const model = modelById(v.modelId);
  if (model.powertrain === 'electric') return fail('Электромобилю долгоблок не нужен.', 'An EV does not take a long block.');
  const offer = longBlockQuote(state, model.size, model.brand);
  return placeOrder(state, offer, rush, true);
}

export function buyFeatured(state: GameState, offerId: string, rush: boolean): ActionResult {
  const offer = state.market.featured.find((o) => o.id === offerId);
  if (!offer || offer.stock <= 0) return fail('Этой позиции больше нет.', 'That item is gone.');
  const res = placeOrder(state, offer, rush, false);
  if (res.ok) offer.stock -= 1;
  return res;
}

function placeOrder(state: GameState, offer: Offer, rush: boolean, premium: boolean): ActionResult {
  const price = Math.round(offer.price * (premium && !offer.featured ? 1.1 : 1) * (rush ? 1.75 : 1));
  if (!charge(state, price, 'parts', l10n(`Заказ: ${offer.name.ru}`, `Order: ${offer.name.en}`))) {
    return fail('Не хватает свободных денег.', 'Not enough free cash.');
  }
  let hours = offer.deliveryHours * (rush ? 0.35 : 1);
  if (hours < 1.2) {
    const part = offerToPart(state, offer, price);
    state.garage.inventory.push(part.uid);
    toast(state, 'good', l10n('Деталь уже на складе.', 'The part is already in stock.'));
    return ok();
  }
  state.garage.deliveries.push({
    id: uid(state, 'del'),
    eta: state.clock.absolute + Math.round(hours * 60),
    offer: { ...offer, price },
    rushed: rush,
  });
  toast(state, 'info', l10n(`Поставка через ${Math.round(hours)} ч.`, `Delivery in ${Math.round(hours)} h.`));
  return ok();
}

function offerToPart(state: GameState, offer: Offer, price: number): PartInstance {
  const part = createPart(
    state,
    {
      type: offer.type,
      size: offer.size,
      quality: offer.quality,
      brand: offer.brand,
      condition: offer.condition,
      manufacturer: offer.manufacturer,
    },
    state.clock.absolute,
    price,
  );
  state.parts[part.uid] = part;
  return part;
}

export function scrapPart(state: GameState, partUid: string): ActionResult {
  if (!state.garage.inventory.includes(partUid)) return fail('Деталь не на складе.', 'The part is not in inventory.');
  const part = state.parts[partUid];
  if (!part) return fail('Деталь потеряна.', 'Part missing.');
  const value = scrapValue(part);
  delete state.parts[partUid];
  state.garage.inventory = state.garage.inventory.filter((id) => id !== partUid);
  pay(state, value, 'other', l10n('Лом детали', 'Scrapped a part'));
  return ok(l10n(`Списано за ${value} ¤.`, `Scrapped for ${value}.`));
}

export function tryStart(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const a = analysisOf(state, v);
  v.serviceStamp = state.clock.absolute;
  if (a.start.fires && a.start.chance >= 0.5) {
    v.runtime.running = true;
    v.runtime.rpm = modelById(v.modelId).engine.idle || 900;
    v.runtime.temp = Math.max(v.runtime.temp, 48);
    v.runtime.throttle = 0.15;
    return ok(l10n('Двигатель схватил.', 'The engine caught.'));
  }
  v.runtime.running = false;
  v.runtime.rpm = a.start.cranks ? 180 : 0;
  const reason = a.start.reasons[0] ?? l10n('Пуск не удался.', 'Start failed.');
  v.clues = v.clues.filter((c) => c.id !== 'start_attempt');
  v.clues.push({
    id: 'start_attempt',
    source: 'idle',
    system: a.start.cranks ? 'engine' : 'electrical',
    at: state.clock.absolute,
    text: reason,
  });
  return { ok: false, message: reason };
}

export function stopEngine(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  v.runtime.running = false;
  v.runtime.rpm = 0;
  v.runtime.throttle = 0;
  return ok(l10n('Двигатель заглушен.', 'Engine stopped.'));
}

export function setThrottle(state: GameState, id: string, throttle: number): void {
  const v = vehicleOf(state, id);
  if (!v || !v.runtime.running) return;
  const model = modelById(v.modelId);
  const a = analysisOf(state, v);
  v.runtime.throttle = throttle;
  const idle = model.engine.idle || (model.powertrain === 'electric' ? 0 : 800);
  const target = idle + throttle * (model.engine.redline - idle) * 0.72;
  const wobble = a.misfire > 0.3 ? Math.sin(state.clock.absolute) * 180 * a.misfire : 0;
  v.runtime.rpm = Math.max(0, target + wobble);
  if (a.overheat > 0.4) v.runtime.temp = Math.min(130, v.runtime.temp + throttle * 1.4);
}

export function requestWash(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!inBay(v) && !state.garage.upgrades.includes('washBay')) return fail('Поставьте машину в бокс или постройте мойку.', 'Put the car in a bay, or build a wash bay.');
  const cost = state.garage.upgrades.includes('washBay') ? 18 : 0;
  if (cost && freeCash(state) < cost) return fail('Не хватает денег на мойку.', 'Not enough cash for the wash.');
  return schedule(state, {
    type: 'wash',
    vehicleId: id,
    extra: { cost },
    total: state.garage.upgrades.includes('washBay') ? 12 : 26,
    label: l10n('Мойка', 'Wash'),
  });
}

export function requestPaint(state: GameState, id: string, color: string, grade: 'cheap' | 'standard' | 'pearl'): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!inBay(v)) return fail('Красят в боксе.', 'Paint happens in a bay.');
  if (!hasCapability(state.garage.tools, state.garage.upgrades, 'paintSystem') && !state.garage.tools.includes('paintGun')) {
    return fail('Нужен краскопульт или камера.', 'Need a paint gun or a booth.');
  }
  const cost = grade === 'cheap' ? 220 : grade === 'pearl' ? 980 : 460;
  if (freeCash(state) < cost) return fail('Не хватает денег на краску.', 'Not enough cash for paint.');
  return schedule(state, {
    type: 'paint',
    vehicleId: id,
    extra: { color, grade, cost },
    total: state.garage.upgrades.includes('paintBooth') ? 90 : 150,
    label: l10n('Покраска', 'Paint'),
  });
}

export function requestSand(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!state.garage.tools.includes('grinder') && !state.garage.upgrades.includes('bodyShop')) return fail('Нужна шлифмашина.', 'A grinder is required.');
  if (freeCash(state) < 60) return fail('Нет денег на абразив.', 'No cash for abrasives.');
  return schedule(state, {
    type: 'sand',
    vehicleId: id,
    extra: { cost: 60 },
    total: 40,
    label: l10n('Подготовка кузова', 'Body prep'),
  });
}

export function refuel(state: GameState, id: string, where: 'garage' | 'station'): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const model = modelById(v.modelId);
  const missing = 1 - v.fuel;
  if (missing <= 0.01) return fail('Бак полон.', 'The tank is full.');
  const unit = model.powertrain === 'electric' ? state.market.fuelPrice * 0.42 : state.market.fuelPrice;
  const price = missing * model.fuelTank * unit * (where === 'garage' ? 1.65 : 1);
  if (!charge(state, price, 'fuel', l10n(where === 'garage' ? 'Канистра в гараже' : 'Заправка', where === 'garage' ? 'Garage can' : 'Fuel station'))) {
    return fail('Не хватает денег на топливо.', 'Not enough cash for fuel.');
  }
  v.fuel = 1;
  return ok(l10n('Бак полный.', 'Tank is full.'));
}

export function sellToDealer(state: GameState, id: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v || v.role !== 'owned') return fail('Продать можно только свою машину.', 'You can only sell your own car.');
  if (v.orderId) return fail('Это машина клиента.', 'This is a customer car.');
  const a = analysisOf(state, v);
  const price = appraise(state, modelById(v.modelId), v, a);
  let payout = price.dealer;
  if (v.trueOdometer > v.odometer * 1.3 && !state.flags[`disclosed:${v.id}`]) {
    if ((state.rng ^ v.odometer) % 3 !== 0) {
      payout = Math.round(payout * 0.9);
      addRep(state, -16);
      toast(state, 'bad', l10n('Дилер нашёл скрученный пробег. Репутация просела.', 'The dealer found a clocked odometer. Reputation fell.'));
    }
  }
  pay(state, payout, 'sale', l10n(`Дилеру: ${modelById(v.modelId).model}`, `Dealer: ${modelById(v.modelId).model}`));
  state.stats.carsSold += 1;
  state.collectionSold.push({ modelId: v.modelId, vin: v.vin, price: payout, at: state.clock.absolute });
  destroyVehicle(state, id);
  addRep(state, 1);
  return ok(l10n(`Дилер заплатил ${payout} ¤.`, `The dealer paid ${payout}.`));
}

export function listCar(state: GameState, id: string, asking: number): ActionResult {
  const v = vehicleOf(state, id);
  if (!v || v.role !== 'owned' || v.orderId) return fail('Эту машину нельзя выставить.', 'This car cannot be listed.');
  v.listingPrice = Math.max(200, Math.round(asking));
  v.location = v.location.startsWith('bay:') ? 'parking' : v.location;
  if (!state.market.listings.some((l) => l.vehicleId === id)) {
    state.market.listings.push({
      id: uid(state, 'list'),
      vehicleId: id,
      asking: v.listingPrice,
      seller: 'player',
      inspected: true,
      note: l10n('Ваше объявление.', 'Your listing.'),
      listedAt: state.clock.absolute,
      expiresAt: state.clock.absolute + 10 * 1440,
    });
  } else {
    const l = state.market.listings.find((x) => x.vehicleId === id);
    if (l) l.asking = v.listingPrice;
  }
  return ok(l10n('Объявление опубликовано.', 'Listing is live.'));
}

export function cancelListing(state: GameState, id: string): ActionResult {
  state.market.listings = state.market.listings.filter((l) => l.vehicleId !== id);
  const v = vehicleOf(state, id);
  if (v) delete v.listingPrice;
  return ok(l10n('Объявление снято.', 'Listing removed.'));
}

export function setDisclosure(state: GameState, id: string, on: boolean): ActionResult {
  state.flags[`disclosed:${id}`] = on;
  return ok(on ? l10n('Пробег будет раскрыт покупателю.', 'Mileage will be disclosed.') : l10n('Пробег скрыт. Это риск.', 'Mileage is hidden. That is a risk.'));
}

export function inspectListing(state: GameState, listingId: string): ActionResult {
  const listing = [...state.market.listings, ...state.market.junk].find((l) => l.id === listingId);
  if (!listing) return fail('Лот не найден.', 'Listing not found.');
  if (listing.inspected) return fail('Осмотр уже сделан.', 'Already inspected.');
  const cost = listing.seller === 'junkyard' ? 80 : 180;
  if (!charge(state, cost, 'other', l10n('Предпродажный осмотр', 'Pre-purchase inspection'))) return fail('Не хватает денег на осмотр.', 'Not enough cash to inspect.');
  const v = vehicleOf(state, listing.vehicleId);
  if (!v) return fail('Машина исчезла.', 'The car is gone.');
  const a = analysisOf(state, v);
  listing.inspected = true;
  listing.systemPeek = {};
  for (const [k, val] of Object.entries(a.systems)) listing.systemPeek[k] = Math.round(val * 100);
  return ok(l10n('Осмотр показал системы, не каждый болт.', 'The inspection shows systems, not every bolt.'));
}

export function buyListing(state: GameState, listingId: string): ActionResult {
  const pool = listingId.startsWith('junk') ? state.market.junk : state.market.listings;
  const listing = [...state.market.listings, ...state.market.junk].find((l) => l.id === listingId);
  if (!listing || listing.seller === 'player') return fail('Этот лот нельзя купить.', 'That lot cannot be bought.');
  if (!hasSpace(state)) return fail('Нет места во дворе или на парковке.', 'No space in the yard or parking.');
  if (!charge(state, listing.asking, 'purchase', l10n('Покупка автомобиля', 'Vehicle purchase'))) return fail('Не хватает денег.', 'Not enough cash.');
  const v = vehicleOf(state, listing.vehicleId);
  if (!v) return fail('Машина уже уехала.', 'The car is already gone.');
  v.role = 'owned';
  v.location = 'yard';
  v.purchasedPrice = listing.asking;
  v.acquiredAt = state.clock.absolute;
  if (listing.systemPeek) {
    for (const [k, val] of Object.entries(listing.systemPeek)) {
      v.clues.push({
        id: `peek_${k}`,
        source: 'visual',
        system: k,
        at: state.clock.absolute,
        text: l10n(`Осмотр перед покупкой: ${k} около ${val}%.`, `Pre-purchase look: ${k} about ${val}%.`),
      });
    }
  }
  state.market.listings = state.market.listings.filter((l) => l.id !== listingId);
  state.market.junk = state.market.junk.filter((l) => l.id !== listingId);
  state.stats.carsBought += 1;
  void pool;
  return ok(l10n('Машина во дворе. Сюрпризы теперь ваши.', 'The car is in the yard. The surprises are yours.'));
}

export function placeBid(state: GameState, lotId: string, amount: number): ActionResult {
  const auction = state.market.auctions.find((a) => !a.resolved);
  const lot = auction?.lots.find((l) => l.id === lotId);
  if (!auction || !lot) return fail('Лот не активен.', 'The lot is not live.');
  const min = lot.currentBid <= 0 ? 200 : Math.max(lot.currentBid + 200, Math.round(lot.currentBid * 1.05));
  if (amount < min) return fail(`Минимальная ставка ${min} ¤.`, `Minimum bid is ${min}.`);
  const already = lot.leader === 'player' ? lot.hold : 0;
  if (state.economy.cash - (heldExcept(state, lot.id)) < amount) return fail('Не хватает свободных денег. Ставка резервируется.', 'Not enough free cash. A bid is reserved.');
  if (lot.leader === 'player') lot.hold = 0;
  lot.currentBid = Math.round(amount);
  lot.leader = 'player';
  lot.hold = Math.round(amount);
  lot.history.push({ who: state.meta.boss, amount: lot.currentBid, at: state.clock.absolute });
  void already;
  return ok(l10n('Ставка принята, деньги удержаны.', 'Bid placed, cash is held.'));
}

function heldExcept(state: GameState, lotId: string): number {
  return state.market.auctions.flatMap((a) => a.lots).filter((l) => l.leader === 'player' && l.id !== lotId).reduce((s, l) => s + l.hold, 0);
}

export function inspectLot(state: GameState, lotId: string): ActionResult {
  const lot = state.market.auctions.flatMap((a) => a.lots).find((l) => l.id === lotId);
  if (!lot) return fail('Лот не найден.', 'Lot not found.');
  if (lot.inspected) return fail('Лот уже смотрели.', 'Already inspected.');
  if (!charge(state, 260, 'other', l10n('Осмотр аукционного лота', 'Auction inspection'))) return fail('Не хватает денег на осмотр.', 'Not enough cash to inspect.');
  const v = vehicleOf(state, lot.vehicleId);
  if (!v) return fail('Лот исчез.', 'The lot vanished.');
  const a = analysisOf(state, v);
  lot.inspected = true;
  v.notes = Object.entries(a.systems)
    .map(([k, val]) => `${k}:${Math.round(val * 100)}`)
    .join(' ');
  return ok(l10n('Грубый осмотр записан в карточку лота.', 'A rough look is on the lot card.'));
}

export function acceptJob(state: GameState, rng: RNG, orderId: string): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'offered') return fail('Заказ недоступен.', 'That job is not available.');
  if (!hasSpace(state)) return fail('Нет места, чтобы принять машину клиента.', 'No space to take the customer car.');
  const v = acceptOrder(state, rng, order);
  if (!v) return fail('Не удалось принять заказ.', 'Could not accept the job.');
  toast(state, 'info', l10n(`${order.customer} оставил машину во дворе.`, `${order.customer} left the car in the yard.`));
  return ok();
}

export function declineJob(state: GameState, orderId: string): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'offered') return fail('Заказ уже не висит.', 'That offer is gone.');
  order.status = 'declined';
  return ok(l10n('Вежливый отказ. Репутация не пострадала.', 'A polite refusal. Reputation is intact.'));
}

export function setInvoice(state: GameState, orderId: string, amount: number): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return fail('Заказ не найден.', 'Order not found.');
  order.invoice = Math.max(0, Math.round(amount));
  return ok();
}

export function deliverJob(state: GameState, orderId: string): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'active') return fail('Заказ не в работе.', 'That job is not active.');
  const v = vehicleOf(state, order.vehicleId);
  if (!v) return fail('Машина клиента потеряна.', 'The customer car is missing.');
  if (!inBay(v)) return fail('Поставьте машину клиента в бокс перед сдачей.', 'Put the customer car in a bay before delivery.');
  const grade = gradeOrder(state, order, v);
  const late = state.clock.absolute > order.deadline;
  const suggested = Math.round(order.payoutBase * (0.4 + grade.ratio * 0.75));
  const invoice = order.invoice || suggested;
  const capMul = order.personality === 'vip' || order.personality === 'collector' ? 1.22 : 1.06;
  let payout = Math.min(invoice, Math.round(order.budget * capMul)) * grade.ratio;
  if (late) payout *= order.personality === 'calm' ? 0.8 : 0.6;
  if (v.dirt > 45 && (order.personality === 'picky' || order.personality === 'vip' || order.personality === 'collector')) payout *= 0.9;
  payout = money(payout);
  pay(state, payout, 'order', l10n(`Заказ: ${order.customer}`, `Job: ${order.customer}`));
  let rep = (grade.ratio - 0.5) * 14 * order.reputationWeight;
  if (late) rep -= order.personality === 'vip' || order.personality === 'racer' ? 12 : 7;
  if (invoice > suggested * 1.35) rep -= 6;
  if (invoice < suggested * 0.8 && grade.ratio > 0.8) rep += 2;
  if (v.dirt > 50) rep -= 2;
  addRep(state, rep);
  const stars = Math.max(1, Math.min(5, Math.round(2 + grade.ratio * 3 - (late ? 1 : 0))));
  const review = stars >= 4
    ? l10n('Работа честная, машину заберу.', 'Honest work. I will take the car.')
    : stars === 3
      ? l10n('Сделано, но без восторга.', 'It is done, without enthusiasm.')
      : l10n('Я ожидал другого. Об этом узнают.', 'I expected better. People will hear.');
  order.status = grade.ratio >= 0.5 ? 'done' : 'failed';
  order.finishedAt = state.clock.absolute;
  order.score = grade.ratio;
  order.review = review;
  state.reviews.unshift({ at: state.clock.absolute, customer: order.customer, stars, text: review, orderId: order.id });
  state.reviews = state.reviews.slice(0, 40);
  if (order.status === 'done') state.stats.ordersCompleted += 1;
  else state.stats.ordersFailed += 1;
  if (grade.ratio < 0.85) {
    state.flags[`comeback:${order.id}`] = state.clock.absolute + 1440;
  }
  state.collectionSold.push({ modelId: v.modelId, vin: v.vin, price: payout, at: state.clock.absolute });
  destroyVehicle(state, v.id);
  toast(state, stars >= 4 ? 'good' : 'warn', l10n(`${order.customer}: ${stars}/5, оплата ${payout} ¤.`, `${order.customer}: ${stars}/5, paid ${payout}.`));
  return ok();
}

export function buyTool(state: GameState, id: string): ActionResult {
  const tool = toolById(id);
  if (!tool) return fail('Инструмент не найден.', 'Tool not found.');
  if (state.garage.tools.includes(id)) return fail('Уже куплено.', 'Already owned.');
  if (!charge(state, tool.price, 'tool', tool.name)) return fail('Не хватает денег.', 'Not enough cash.');
  state.garage.tools.push(id);
  return ok(l10n('Инструмент в ящике.', 'The tool is in the chest.'));
}

export function buyUpgrade(state: GameState, id: string): ActionResult {
  const up = upgradeById(id);
  if (!up) return fail('Улучшение не найдено.', 'Upgrade not found.');
  if (state.garage.upgrades.includes(id)) return fail('Уже построено.', 'Already built.');
  if (up.requires.some((r) => !state.garage.upgrades.includes(r) && !state.garage.tools.includes(r))) {
    return fail('Не выполнены требования.', 'Requirements are not met.');
  }
  if (up.rep && state.reputation < up.rep) return fail('Недостаточно репутации.', 'Reputation is too low.');
  if (!charge(state, up.price, 'upgrade', up.name)) return fail('Не хватает денег.', 'Not enough cash.');
  state.garage.upgrades.push(id);
  syncGarage(state);
  toast(state, 'good', l10n(`${up.name.ru} готово.`, `${up.name.en} is ready.`));
  return ok();
}

export function borrow(state: GameState, amount: number): ActionResult {
  const room = creditLimit(state) - state.economy.debt;
  const take = Math.min(Math.round(amount), room);
  if (take < 200) return fail('Кредит такого размера недоступен.', 'A loan that small is not available.');
  state.economy.debt += take;
  pay(state, take, 'loan', l10n('Кредит получен', 'Loan drawn'));
  return ok(l10n(`На счёт пришло ${take} ¤.`, `${take} arrived.`));
}

export function repay(state: GameState, amount: number): ActionResult {
  const payAmt = Math.min(state.economy.debt, Math.round(amount));
  if (payAmt <= 0) return fail('Долга нет.', 'There is no debt.');
  if (!charge(state, payAmt, 'loan', l10n('Погашение кредита', 'Loan repayment'))) return fail('Не хватает денег.', 'Not enough cash.');
  state.economy.debt -= payAmt;
  return ok(l10n('Долг уменьшен.', 'Debt reduced.'));
}

export function hire(state: GameState, id: string): ActionResult {
  if (state.employees.length >= hireLimit(state)) return fail('Лимит штата. Нужен офис или шоурум.', 'Staff cap reached. You need an office or a showroom.');
  const cand = state.candidates.find((c) => c.id === id);
  if (!cand) return fail('Кандидат уже ушёл.', 'That candidate is gone.');
  if (!charge(state, cand.wage, 'salary', l10n(`Найм: ${cand.name}`, `Hire: ${cand.name}`))) return fail('Нет денег на первый аванс.', 'No cash for the signing advance.');
  state.employees.push(cand);
  state.candidates = state.candidates.filter((c) => c.id !== id);
  state.stats.employeesHired += 1;
  return ok(l10n(`${cand.name} вышел в смену.`, `${cand.name} is on shift.`));
}

export function fire(state: GameState, id: string): ActionResult {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return fail('Сотрудник не найден.', 'Employee not found.');
  const severance = emp.wage;
  if (freeCash(state) >= severance) {
    charge(state, severance, 'salary', l10n(`Пособие: ${emp.name}`, `Severance: ${emp.name}`));
  } else {
    addRep(state, -6);
    toast(state, 'bad', l10n('Пособие не выплачено. Об этом говорят.', 'Severance was not paid. People talk.'));
  }
  state.employees = state.employees.filter((e) => e.id !== id);
  return ok(l10n(`${emp.name} уволен.`, `${emp.name} was fired.`));
}

export function setOvertime(state: GameState, id: string, on: boolean): ActionResult {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return fail('Сотрудник не найден.', 'Employee not found.');
  emp.overtime = on;
  return ok();
}

export function setAutoBuy(state: GameState, on: boolean): ActionResult {
  state.flags.allowEmployeePurchases = on;
  return ok(on ? l10n('Сотрудник может закупать аналоги.', 'Employees may buy aftermarket parts.') : l10n('Закупка только со склада.', 'Purchases are stock-only.'));
}

export function train(state: GameState, id: string): ActionResult {
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return fail('Сотрудник не найден.', 'Employee not found.');
  const cost = 480 * emp.level;
  if (!charge(state, cost, 'other', l10n(`Обучение: ${emp.name}`, `Training: ${emp.name}`))) return fail('Нет денег на курсы.', 'No cash for training.');
  gainXp(emp, 30 + emp.level * 6);
  emp.morale = Math.min(100, emp.morale + 4);
  return ok(l10n('Уровень подрос.', 'Level increased.'));
}

export function assignWork(state: GameState, empId: string, type: string, vehicleId: string, slot?: string): ActionResult {
  const emp = state.employees.find((e) => e.id === empId);
  const v = vehicleOf(state, vehicleId);
  if (!emp || !v) return fail('Нет сотрудника или машины.', 'Missing employee or car.');
  if (emp.task) return fail('Сотрудник уже занят.', 'That employee is already busy.');
  if (!inBay(v)) return fail('Машина должна стоять в боксе.', 'The car must be in a bay.');
  const bay = Number(v.location.split(':')[1] ?? 0);
  emp.assignedBay = bay;
  const speed = Math.max(0.5, emp.speed * (emp.morale / 80));
  const total = type === 'diagnose' ? 30 : type === 'wash' ? 20 : type === 'paint' ? 80 : type === 'order-auto' ? 40 : slot ? Math.round(actionMinutes(state, v, slot, speed) ) : 30;
  emp.task = {
    id: uid(state, 'etask'),
    type,
    vehicleId,
    slot,
    remaining: total,
    total,
    label: l10n(`${emp.name}: ${type}`, `${emp.name}: ${type}`),
    actor: emp.id,
  };
  return ok(l10n('Задача назначена.', 'Task assigned.'));
}

export function searchStaff(state: GameState, rng: RNG): ActionResult {
  if (!charge(state, 80, 'other', l10n('Поиск сотрудников', 'Staff search'))) return fail('Нет денег на объявление.', 'No cash for the ad.');
  refreshCandidates(state, rng);
  return ok(l10n('Новые кандидаты у ворот.', 'New candidates are at the gate.'));
}

export function tuneEcu(state: GameState, id: string, value: number): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  if (!hasCapability(state.garage.tools, state.garage.upgrades, 'scanner') && !state.garage.upgrades.includes('engineShop')) {
    return fail('Нужен сканер или моторный цех.', 'Need a scanner or the engine shop.');
  }
  v.tune.ecuPower = Math.max(-0.08, Math.min(0.18, value));
  return ok(l10n('Прошивка записана.', 'Map written.'));
}

export function tuneRide(state: GameState, id: string, value: number): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  v.tune.ride = Math.max(-0.06, Math.min(0.05, value));
  return ok();
}

export function tuneAero(state: GameState, id: string, value: number): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const model = modelById(v.modelId);
  const hasWing = !!v.slots.wing;
  if (!hasWing && model.body !== 'supercar' && model.class !== 'race') return fail('Нет антикрыла и это не суперкар.', 'No wing, and this is not a supercar.');
  v.tune.aero = Math.max(0, Math.min(1, value));
  return ok();
}

export function saveSetup(state: GameState, id: string, name: string): ActionResult {
  const v = vehicleOf(state, id);
  if (!v) return fail('Машина не найдена.', 'Car not found.');
  const parts: Record<string, string> = {};
  for (const [slot, uidPart] of Object.entries(v.slots)) {
    if (!uidPart) continue;
    parts[slot] = state.parts[uidPart]?.defKey ?? '';
  }
  state.setups.push({ name: name.slice(0, 24) || 'Setup', modelId: v.modelId, notes: '', tune: { ...v.tune }, parts });
  return ok(l10n('Конфигурация сохранена.', 'Setup saved.'));
}

export function requestDyno(state: GameState, id: string): ActionResult {
  if (!state.garage.upgrades.includes('dyno')) return fail('Нет стенда.', 'No dyno.');
  const v = vehicleOf(state, id);
  if (!v || !inBay(v)) return fail('Поставьте машину в бокс со стендом.', 'Put the car in the dyno bay.');
  return schedule(state, { type: 'dyno', vehicleId: id, total: 20, label: l10n('Замер на стенде', 'Dyno pull') });
}

export function requestAlign(state: GameState, id: string): ActionResult {
  if (!state.garage.upgrades.includes('alignment')) return fail('Нет стенда развала.', 'No alignment rack.');
  const v = vehicleOf(state, id);
  if (!v || !inBay(v)) return fail('Нужен бокс.', 'A bay is required.');
  if (freeCash(state) < 90) return fail('Нет денег на развал.', 'No cash for alignment.');
  return schedule(state, { type: 'align', vehicleId: id, extra: { cost: 90 }, total: 35, label: l10n('Развал', 'Alignment') });
}

export function requestLongBlock(state: GameState, id: string, partUid: string): ActionResult {
  const v = vehicleOf(state, id);
  const part = state.parts[partUid];
  if (!v || !part || part.type !== 'longBlock') return fail('Нет долгоблока на складе.', 'No long block in stock.');
  if (!inBay(v)) return fail('Нужен бокс.', 'A bay is required.');
  if (!liftAvailable(state) && !state.garage.upgrades.includes('engineShop')) return fail('Нужен подъёмник или моторный цех.', 'Need a lift or the engine shop.');
  return schedule(state, {
    type: 'longblock',
    vehicleId: id,
    partUid,
    total: state.garage.upgrades.includes('engineShop') ? 220 : 360,
    label: l10n('Установка долгоблока', 'Long-block install'),
  });
}

export function resolveEvent(state: GameState, rng: RNG, eventId: string, choice: string): ActionResult {
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev || ev.resolved) return fail('Событие закрыто.', 'That event is closed.');
  ev.resolved = true;
  if (choice === 'ignore' || choice === 'pass' || choice === 'skip') {
    return ok(l10n('Вы прошли мимо.', 'You walked past it.'));
  }
  if (ev.kind === 'repair-lift' && choice === 'fix') {
    if (!charge(state, 380, 'other', l10n('Ремонт подъёмника', 'Lift repair'))) {
      ev.resolved = false;
      return fail('Не хватает денег на ремонт.', 'Not enough cash to repair it.');
    }
    state.flags.liftBrokenUntil = 0;
    return ok(l10n('Подъёмник снова жив.', 'The lift is alive again.'));
  }
  if (ev.kind === 'buy-project' && choice === 'buy') {
    const kind = String(ev.payload?.project ?? 'abandoned-sport');
    const price = Number(ev.payload?.price ?? 3500);
    if (!hasSpace(state)) return fail('Нет места.', 'No space.');
    if (!charge(state, price, 'purchase', l10n('Редкий проект', 'Rare project'))) {
      ev.resolved = false;
      return fail('Не хватает денег.', 'Not enough cash.');
    }
    const opt = projectPreset(kind, rng);
    const v = createVehicle(state, rng, { ...opt, role: 'owned', location: 'yard' });
    v.purchasedPrice = price;
    state.stats.carsBought += 1;
    return ok(l10n('Проект во дворе. Это надолго.', 'The project is in the yard. This will take a while.'));
  }
  if (ev.kind === 'take-order' && choice === 'take') {
    const id = String(ev.payload?.template ?? 'urgent_brakes');
    createOffer(state, rng, id);
    return ok(l10n('Заказ в списке предложений.', 'The job is in the offer list.'));
  }
  if (ev.kind === 'parts-sale') {
    const cat = String(ev.payload?.category ?? 'brakes');
    state.market.categoryMul[cat] = 0.72;
    state.flags[`saleUntil:${cat}`] = state.clock.absolute + 2 * 1440;
    return ok(l10n('Скидка действует два дня.', 'The discount lasts two days.'));
  }
  return ok();
}

export function finishTask(state: GameState, rng: RNG, task: WorkTask): void {
  const v = task.vehicleId ? vehicleOf(state, task.vehicleId) : null;
  const actor = task.actor === 'player' ? null : state.employees.find((e) => e.id === task.actor);
  try {
    if (task.type === 'move' && v && task.extra?.location) {
      v.location = String(task.extra.location) as VehicleInstance['location'];
      v.runtime.running = false;
      return;
    }
    if (!v) return;
    if (task.type === 'inspect' && task.slot) {
      if (!v.inspected.includes(task.slot)) v.inspected.push(task.slot);
      const uidPart = v.slots[task.slot];
      const part = uidPart ? state.parts[uidPart] : null;
      const cond = part ? Math.round(part.condition) : 0;
      const spec = slotById(modelById(v.modelId), task.slot);
      v.clues.push({
        id: `insp_${task.slot}_${cond}`,
        source: 'visual',
        system: spec?.system ?? 'body',
        at: state.clock.absolute,
        text: part
          ? l10n(`${spec?.name.ru ?? task.slot}: ${cond}%.`, `${spec?.name.en ?? task.slot}: ${cond}%.`)
          : l10n(`${spec?.name.ru ?? task.slot} отсутствует.`, `${spec?.name.en ?? task.slot} is missing.`),
      });
      if ((task.slot.startsWith('seat') || task.slot === 'dashboard' || task.slot === 'steeringWheel') && v.trueOdometer > v.odometer * 1.3) {
        state.flags[`fraudKnown:${v.id}`] = true;
        v.clues.push({
          id: 'fraud_cabin',
          source: 'history',
          system: 'interior',
          at: state.clock.absolute,
          text: l10n('Износ салона не сходится с одометром.', 'Cabin wear does not match the odometer.'),
        });
      }
      skillGain(state, 0.02);
      return;
    }
    if (task.type === 'remove' && task.slot) {
      const uidPart = v.slots[task.slot];
      if (!uidPart) return;
      const part = state.parts[uidPart];
      v.slots[task.slot] = null;
      if (part) {
        part.installedIn = null;
        part.slot = null;
        state.garage.inventory.push(part.uid);
      }
      if (task.slot === 'hood') v.panels.hood = false;
      skillGain(state, 0.02);
      state.stats.partsReplaced += 1;
      toast(state, 'info', l10n(`${task.slot} на складе.`, `${task.slot} is in stock.`));
      return;
    }
    if (task.type === 'install' && task.slot && task.partUid) {
      const part = state.parts[task.partUid];
      if (!part || !state.garage.inventory.includes(part.uid) || v.slots[task.slot]) {
        toast(state, 'bad', l10n('Установка сорвалась: слот или склад изменились.', 'Install failed: the slot or stock changed.'));
        return;
      }
      if (actor && actor.quality < 0.9 && rng.chance(0.22)) {
        part.condition = Math.max(40, part.condition - rng.int(6, 14));
        toast(state, 'warn', l10n(`${actor.name} поставил деталь криво.`, `${actor.name} fitted the part poorly.`));
      }
      v.slots[task.slot] = part.uid;
      part.installedIn = v.id;
      part.slot = task.slot;
      state.garage.inventory = state.garage.inventory.filter((p) => p !== part.uid);
      skillGain(state);
      if (actor) gainXp(actor, 8);
      checkProject(state, v);
      return;
    }
    if (task.type === 'repair' && task.slot) {
      const uidPart = v.slots[task.slot];
      const part = uidPart ? state.parts[uidPart] : null;
      if (!part) return;
      const cost = Number(task.extra?.cost ?? 30);
      if (!charge(state, cost, 'parts', l10n(`Материалы: ${task.slot}`, `Materials: ${task.slot}`))) {
        toast(state, 'bad', l10n('Ремонт остановлен: нет денег на материалы.', 'Repair stopped: no cash for materials.'));
        return;
      }
      const cap = repairCap(state, part, actor?.quality);
      part.condition = Math.round(Math.min(cap, part.condition + (cap - part.condition) * 0.85));
      v.repairLog.push({ at: state.clock.absolute, text: l10n(`Ремонт ${task.slot}`, `Repaired ${task.slot}`), cost });
      skillGain(state, 0.03);
      if (actor) gainXp(actor, 10);
      checkProject(state, v);
      return;
    }
    if (task.type === 'visual' || task.type === 'listen' || task.type === 'scan' || task.type === 'meter' || task.type === 'compression' || task.type === 'idle') {
      applyDiag(state, v, task.type, actor ?? null);
      return;
    }
    if (task.type === 'wash') {
      const cost = Number(task.extra?.cost ?? 0);
      if (cost) charge(state, cost, 'other', l10n('Мойка', 'Wash'));
      v.dirt = state.garage.upgrades.includes('washBay') ? 0 : 12;
      return;
    }
    if (task.type === 'paint') {
      const cost = Number(task.extra?.cost ?? 400);
      if (!charge(state, cost, 'other', l10n('Краска', 'Paint'))) {
        toast(state, 'bad', l10n('Покраска отменена: нет денег.', 'Paint cancelled: no cash.'));
        return;
      }
      const grade = String(task.extra?.grade ?? 'standard');
      const a = analysisOf(state, v);
      let cap = state.garage.upgrades.includes('paintBooth') ? 97 : 68;
      if (state.employees.some((e) => e.role === 'painter') || actor?.role === 'painter') cap += 3;
      if (grade === 'cheap') cap -= 14;
      if (grade === 'pearl' && !state.garage.upgrades.includes('paintBooth')) cap = Math.min(cap, 72);
      if (a.bodyScore < 55) cap = Math.min(cap, 58);
      v.paintCondition = Math.round(cap);
      v.color = String(task.extra?.color ?? v.color);
      v.dirt = Math.min(v.dirt, 8);
      v.repairLog.push({ at: state.clock.absolute, text: l10n('Покраска', 'Paint'), cost });
      checkProject(state, v);
      return;
    }
    if (task.type === 'sand') {
      charge(state, Number(task.extra?.cost ?? 60), 'other', l10n('Абразив', 'Abrasive'));
      const cap = state.garage.upgrades.includes('bodyShop') ? 82 : 74;
      for (const [slot, uidPart] of Object.entries(v.slots)) {
        if (!uidPart) continue;
        const part = state.parts[uidPart];
        if (!part) continue;
        if (['hood', 'door', 'fender', 'bumper', 'roof', 'trunk'].includes(part.type) && part.condition < cap) {
          part.condition = Math.min(cap, part.condition + 16);
        }
        void slot;
      }
      return;
    }
    if (task.type === 'dyno') {
      const a = analysisOf(state, v);
      const model = modelById(v.modelId);
      const curve = [];
      for (let rpm = model.engine.idle || 800; rpm <= model.engine.redline; rpm += Math.round(model.engine.redline / 8)) {
        const x = (rpm - (model.engine.idle || 0)) / model.engine.redline;
        const shape = model.powertrain === 'electric' ? 1 - Math.max(0, x - 0.2) * 0.4 : Math.sin(Math.min(1, x) * Math.PI) * 0.35 + 0.65;
        curve.push({ rpm, hp: Math.round(a.powerHp * shape), tq: Math.round(a.torqueNm * (model.powertrain === 'electric' ? 1 - x * 0.45 : 0.7 + 0.3 * shape)) });
      }
      v.dyno = { at: state.clock.absolute, peakPower: Math.round(a.powerHp), peakTorque: Math.round(a.torqueNm), curve };
      toast(state, 'good', l10n(`Стенд: ${Math.round(a.powerHp)} л.с.`, `Dyno: ${Math.round(a.powerHp)} hp.`));
      return;
    }
    if (task.type === 'align') {
      charge(state, 90, 'other', l10n('Развал-схождение', 'Alignment'));
      v.aligned = true;
      toast(state, 'info', l10n('Увод от рычагов снижен. Шины и суппорта развал не лечит.', 'Pull from the arms is reduced. Alignment does not fix tires or calipers.'));
      return;
    }
    if (task.type === 'longblock' && task.partUid) {
      const block = state.parts[task.partUid];
      if (!block) return;
      state.garage.inventory = state.garage.inventory.filter((p) => p !== block.uid);
      delete state.parts[block.uid];
      for (const slot of LONG_BLOCK_SLOTS) {
        if (!(slot in v.slots)) continue;
        const old = v.slots[slot];
        if (old) delete state.parts[old];
        const spec = slotById(modelById(v.modelId), slot);
        if (!spec) continue;
        const neu = createPart(state, { type: spec.type, size: spec.size, quality: 'oem', brand: modelById(v.modelId).brand, condition: 96, manufacturer: 'Crate Line' }, state.clock.absolute, 0);
        neu.installedIn = v.id;
        neu.slot = slot;
        state.parts[neu.uid] = neu;
        v.slots[slot] = neu.uid;
      }
      v.repairLog.push({ at: state.clock.absolute, text: l10n('Установлен долгоблок', 'Long block fitted'), cost: block.purchasePrice });
      checkProject(state, v);
      toast(state, 'good', l10n('Долгоблок на месте. Старые внутренности списаны.', 'Long block is in. The old internals are scrapped.'));
      return;
    }
    if (task.type === 'diagnose' && actor) {
      applyDiag(state, v, 'visual', actor);
      applyDiag(state, v, actor.role === 'diagnostician' || actor.role === 'electrician' ? 'scan' : 'listen', actor);
      gainXp(actor, 6);
      return;
    }
    if (task.type === 'order-auto' && actor) {
      autoService(state, rng, v, actor);
      return;
    }
  } catch (err) {
    toast(state, 'bad', l10n('Операция прервана ошибкой. Прогресс машины сохранён.', 'The operation stopped on an error. The car is unchanged beyond the last step.'));
    console.error(err);
  }
}

function repairCap(state: GameState, part: PartInstance, quality?: number): number {
  const specType = part.type;
  const body = ['hood', 'door', 'fender', 'bumper', 'roof', 'trunk', 'wing', 'splitter'].includes(specType);
  let cap = body
    ? state.garage.upgrades.includes('bodyShop')
      ? 88
      : 76
    : partType(specType).internal
      ? state.garage.upgrades.includes('engineShop')
        ? 86
        : 64
      : 78;
  cap += (quality ?? Number(state.flags.playerSkill ?? 2) / 5) * 6;
  return Math.min(96, cap);
}

function applyDiag(state: GameState, v: VehicleInstance, kind: string, actor: { role: string; quality: number } | null): void {
  const a = analysisOf(state, v);
  const push = (id: string, system: string, text: L10n, source: typeof v.clues[number]['source']) => {
    if (v.clues.some((c) => c.id === id)) return;
    v.clues.push({ id, system, text, source, at: state.clock.absolute });
  };
  if (kind === 'visual') {
    for (const s of a.symptoms.filter((s) => s.sources.includes('visual'))) push(s.id, s.system, s.text, 'visual');
    if (actor?.role === 'diagnostician') {
      for (const slot of Object.keys(v.slots)) {
        if (slot.startsWith('fender') || slot.startsWith('wheel') || slot.includes('light')) {
          if (!v.inspected.includes(slot)) v.inspected.push(slot);
        }
      }
    }
  }
  if (kind === 'listen') {
    for (const s of a.symptoms.filter((s) => s.sources.includes('sound'))) push(s.id, s.system, s.text, 'sound');
  }
  if (kind === 'scan') {
    v.scanned = true;
    if (state.garage.upgrades.includes('diagCenter') || actor?.role === 'diagnostician') v.deepScanned = true;
    if (!a.codes.length) push('scan_clean', 'electrical', l10n('Сканер не видит активных кодов.', 'The scanner sees no active codes.'), 'scan');
    for (const c of a.codes) push(c.id, c.system, c.text, 'scan');
    if (v.deepScanned) {
      for (const [sys, val] of Object.entries(a.systems)) {
        push(`deep_${sys}`, sys, l10n(`${sys}: около ${Math.round(val * 100)}% по глубокому скану.`, `${sys}: about ${Math.round(val * 100)}% on a deep scan.`), 'scan');
      }
    }
  }
  if (kind === 'meter') {
    push(
      'volt_rest',
      'electrical',
      l10n(`Покой: ${a.batteryVoltage.toFixed(2)} В.`, `Resting: ${a.batteryVoltage.toFixed(2)} V.`),
      'multimeter',
    );
    if (v.runtime.running) {
      push('volt_run', 'electrical', l10n(`Зарядка: ${a.chargingVoltage.toFixed(2)} В.`, `Charging: ${a.chargingVoltage.toFixed(2)} V.`), 'multimeter');
    } else {
      push('volt_off', 'electrical', l10n('Мотор молчит — зарядку не измерить.', 'The engine is off, so charging cannot be measured.'), 'multimeter');
    }
    push('sensor_skew', 'electrical', l10n(`Отклонение датчика: ${Math.round(a.sensorSkew * 100)}%.`, `Sensor skew: ${Math.round(a.sensorSkew * 100)}%.`), 'multimeter');
  }
  if (kind === 'compression') {
    push(
      'comp',
      'engine',
      l10n(`Компрессия, бар: ${a.compression.join(', ')}.`, `Compression, bar: ${a.compression.join(', ')}.`),
      'compression',
    );
  }
  if (kind === 'idle') {
    for (const s of a.symptoms.filter((s) => s.sources.includes('idle'))) push(`idle_${s.id}`, s.system, s.text, 'idle');
    if (a.smoke !== 'none') {
      push('idle_smoke', 'engine', l10n(`Дым на холостых: ${a.smoke}.`, `Idle smoke: ${a.smoke}.`), 'idle');
    }
    v.runtime.temp += a.overheat * 18;
  }
  skillGain(state, 0.01);
}

function autoService(state: GameState, rng: RNG, v: VehicleInstance, actor: NonNullable<ReturnType<typeof state.employees.find>>): void {
  const order = state.orders.find((o) => o.id === v.orderId);
  if (!order) {
    toast(state, 'warn', l10n('Автозадача: у машины нет заказа.', 'Auto task: the car has no job.'));
    return;
  }
  const grade = gradeOrder(state, order, v);
  const failed = new Set(grade.lines.filter((l) => !l.ok).map((l) => l.id));
  const map: Record<string, string[]> = {
    fluids_fresh: ['oil', 'oilFilter'],
    starts: ['battery', 'starter', 'fuelPump', 'sparkPlugs', 'ignitionCoils', 'batteryPack', 'inverter'],
    charging: ['alternator', 'belts', 'wiring', 'bms', 'isolation'],
    brakes_ok: ['brakePad_fl', 'brakePad_fr', 'brakePad_rl', 'brakePad_rr', 'brakeFluid'],
    idle_stable: ['sparkPlugs', 'ignitionCoils', 'injectors'],
    no_overheat: ['thermostat', 'coolant', 'radiator'],
    lights_ok: ['headlight_l', 'headlight_r', 'taillight_l', 'taillight_r'],
    tires_ok: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
    no_vibration: ['bearing_fl', 'bearing_fr', 'bearing_rl', 'bearing_rr'],
    no_pull: ['arm_fl', 'wheel_fl', 'caliper_fl'],
    no_ecu_critical: ['sensors', 'ecu', 'wiring'],
  };
  const slots = new Set<string>();
  for (const id of failed) for (const s of map[id] ?? []) if (s in v.slots) slots.add(s);
  let fixed = 0;
  for (const slot of slots) {
    const cur = v.slots[slot] ? state.parts[v.slots[slot] as string] : null;
    if (cur && cur.condition >= 70) continue;
    const spec = slotById(modelById(v.modelId), slot);
    if (!spec) continue;
    let part = state.garage.inventory.map((id) => state.parts[id]).find((p) => p && fitsVehicle(p, spec.type, spec.size, modelById(v.modelId).brand) && p.condition >= 80);
    if (!part && state.flags.allowEmployeePurchases) {
      const offer = quote(state, spec.type, spec.size, 'aftermarket', null, `auto${slot}${state.clock.absolute}`);
      if (freeCash(state) >= offer.price) {
        charge(state, offer.price, 'parts', l10n(`Закупка сотрудника: ${slot}`, `Employee purchase: ${slot}`));
        part = offerToPart(state, offer, offer.price);
      }
    }
    if (!part) continue;
    if (cur) {
      cur.installedIn = null;
      cur.slot = null;
      state.garage.inventory.push(cur.uid);
    }
    v.slots[slot] = part.uid;
    part.installedIn = v.id;
    part.slot = slot;
    state.garage.inventory = state.garage.inventory.filter((id) => id !== part!.uid);
    if (!v.inspected.includes(slot)) v.inspected.push(slot);
    fixed += 1;
  }
  gainXp(actor, 12);
  toast(state, 'info', l10n(`${actor.name} закрыл узлов: ${fixed}. Проверьте работу.`, `${actor.name} closed ${fixed} parts. Check the work.`));
}

export function checkProject(state: GameState, v: VehicleInstance): void {
  if (!v.projectId || state.stats.projectsFinished.includes(v.id)) return;
  const a = analysisOf(state, v);
  const missing = Object.values(a.parts).some((p) => p.missing);
  if (missing || !a.start.fires || a.bodyScore < 68 || v.paintCondition < 70 || a.systems.engine < 0.62) return;
  state.stats.projectsFinished.push(v.id);
  addRep(state, 28);
  toast(state, 'good', l10n('Редкий проект собран. Цена это уже знает.', 'The rare project is together. The price already knows.'));
}

export function commitRun(
  state: GameState,
  id: string,
  run: {
    distanceKm: number;
    fuel: number;
    temp: number;
    zeroTo100: number | null;
    quarter: number | null;
    brake100: number | null;
    top: number;
    lateral: number;
    weather: GameState['weather']['kind'];
    brakeWear: number;
    tireWear: number;
    heat: number;
  },
): void {
  const v = vehicleOf(state, id);
  if (!v) return;
  v.fuel = run.fuel;
  v.runtime.temp = run.temp;
  v.runtime.running = false;
  v.odometer += Math.round(run.distanceKm);
  v.trueOdometer += Math.round(run.distanceKm);
  state.stats.distanceKm += run.distanceKm;
  const wear = (slot: string, amount: number) => {
    const uidPart = v.slots[slot];
    if (!uidPart || !state.parts[uidPart]) return;
    state.parts[uidPart].condition = Math.max(0, state.parts[uidPart].condition - amount);
  };
  for (const c of ['fl', 'fr', 'rl', 'rr']) {
    wear(`wheel_${c}`, run.tireWear * 8 + run.distanceKm * 0.08);
    wear(`brakePad_${c}`, run.brakeWear * 30);
  }
  if (!modelById(v.modelId).powertrain || modelById(v.modelId).powertrain === 'ice') {
    wear('oil', run.distanceKm * 0.05);
    if (run.heat > 0.2) {
      wear('headGasket', run.heat * 12);
      wear('pistons', run.heat * 8);
    }
  }
  v.telemetry.unshift({
    at: state.clock.absolute,
    zeroTo100: run.zeroTo100,
    quarterMile: run.quarter,
    brake100: run.brake100,
    topSpeed: run.top,
    maxRpm: v.runtime.rpm,
    maxTemp: run.temp,
    maxLateral: run.lateral,
    distanceKm: run.distanceKm,
    weather: run.weather,
    surfaceNote: l10n('Заезд на площадке', 'Pad run'),
  });
  v.telemetry = v.telemetry.slice(0, 8);
  if (run.zeroTo100 && run.weather === 'clear') {
    if (state.stats.bestZeroTo100 == null || run.zeroTo100 < state.stats.bestZeroTo100) state.stats.bestZeroTo100 = run.zeroTo100;
  }
  const a = analysisOf(state, v);
  for (const s of a.symptoms.filter((s) => s.sources.includes('testdrive'))) {
    if (!v.clues.some((c) => c.id === `td_${s.id}`)) {
      v.clues.push({ id: `td_${s.id}`, source: 'testdrive', system: s.system, at: state.clock.absolute, text: s.text });
    }
  }
}

export function clockLabel(state: GameState): string {
  const c = clockParts(state.clock.absolute);
  return `${c.day} / ${c.label}`;
}

