import type { Auction, GameState, Listing, VehicleInstance } from '../Core/types';
import { RNG } from '../Core/rng';
import { l10n, money, seasonOf, uid } from '../Core/util';
import { addLedger, charge, freeCash, notify, pay, rentOf, taxRate, weeklyReport } from '../Economy/economy';
import { createOffer } from '../Orders/logic';
import { appraise, saleChance } from '../Market/pricing';
import { refreshFeatured } from '../Market/offers';
import { analyze } from '../Vehicles/analysis';
import { createVehicle } from '../Vehicles/factory';
import { createPart } from '../VehicleParts/build';
import { MODELS, modelById } from '../Vehicles/models';
import { gainXp, payroll, refreshCandidates } from '../Employees/staff';
import { bayCount } from '../Tools/definitions';
import { finishTask } from './actions';
import { addRep, capacity, destroyVehicle, hasSpace, occupying, pullRng, pushRng, toast } from './helpers';
import { rollWeather } from '../Weather/weather';

export function bootstrapWorld(state: GameState): void {
  const rng = pullRng(state);
  refreshFeatured(state, rng);
  refreshCandidates(state, rng);
  fillMarket(state, rng, true);
  rollWeather(state, rng);
  pushRng(state, rng);
}

export function advanceMinutes(state: GameState, minutes: number): void {
  const steps = Math.max(0, Math.min(20000, Math.floor(minutes)));
  for (let i = 0; i < steps; i++) {
    if (state.meta.bankrupt) break;
    state.clock.absolute += 1;
    const rng = pullRng(state);
    onMinute(state, rng);
    const minute = state.clock.absolute % 60;
    const minuteOfDay = state.clock.absolute % 1440;
    if (minute === 0) onHour(state, rng);
    if (minuteOfDay === 0) onDay(state, rng);
    pushRng(state, rng);
  }
}

function onMinute(state: GameState, rng: RNG): void {
  progressPlayer(state, rng);
  progressEmployees(state, rng);
  resolveDeliveries(state);
  if (state.clock.absolute % 5 === 0) auctionTick(state, rng);
  for (const v of state.vehicles) {
    if (v.lights && !v.runtime.running && v.slots.battery && state.parts[v.slots.battery]) {
      if (state.clock.absolute % 30 === 0) {
        state.parts[v.slots.battery].condition = Math.max(0, state.parts[v.slots.battery].condition - 0.35);
      }
    }
    if (v.runtime.running) {
      const a = analyze(modelById(v.modelId), v, state.parts);
      v.runtime.temp = Math.min(140, v.runtime.temp + a.overheat * 0.8 - a.cooling * 0.3);
      if (a.misfire > 0.3) v.runtime.rpm += Math.sin(state.clock.absolute / 2) * 40;
    }
  }
}

function progressPlayer(state: GameState, rng: RNG): void {
  const job = state.work.active;
  if (!job) return;
  job.remaining -= 1;
  if (job.remaining > 0) return;
  state.work.active = state.work.queue.shift() ?? null;
  finishTask(state, rng, job);
}

function progressEmployees(state: GameState, rng: RNG): void {
  const hour = Math.floor((state.clock.absolute % 1440) / 60);
  for (const emp of state.employees) {
    if (!emp.task) continue;
    const working = (hour >= 8 && hour < 18) || emp.overtime;
    if (!working) continue;
    const morale = Math.max(0.35, emp.morale / 80);
    emp.task.remaining -= emp.speed * morale;
    if (emp.overtime && hour >= 18) emp.morale = Math.max(0, emp.morale - 0.02);
    if (emp.task.remaining > 0) continue;
    const task = emp.task;
    emp.task = null;
    finishTask(state, rng, task);
    gainXp(emp, 4);
  }
}

function resolveDeliveries(state: GameState): void {
  const due = state.garage.deliveries.filter((d) => d.eta <= state.clock.absolute);
  if (!due.length) return;
  state.garage.deliveries = state.garage.deliveries.filter((d) => d.eta > state.clock.absolute);
  for (const d of due) {
    const part = createPart(
      state,
      {
        type: d.offer.type,
        size: d.offer.size,
        quality: d.offer.quality,
        brand: d.offer.brand,
        condition: d.offer.condition,
        manufacturer: d.offer.manufacturer,
      },
      state.clock.absolute,
      d.offer.price,
    );
    state.parts[part.uid] = part;
    state.garage.inventory.push(part.uid);
    toast(state, 'good', l10n(`Пришло: ${d.offer.name.ru}`, `Arrived: ${d.offer.name.en}`));
  }
}

function onHour(state: GameState, _rng: RNG): void {
  state.economy.powerBill += 1.2 + state.garage.upgrades.length * 0.35;
  if (state.weather.kind === 'snow' || state.weather.kind === 'heavy-rain') state.economy.powerBill += 0.4;
}

function onDay(state: GameState, rng: RNG): void {
  const day = Math.floor(state.clock.absolute / 1440) + 1;
  state.market.season = seasonOf(day);
  rollWeather(state, rng);
  driftMarket(state, rng);
  fillMarket(state, rng, false);
  refreshFeatured(state, rng);
  resolvePlayerSales(state, rng);
  rivalBuys(state, rng);
  expireOrders(state);
  if (rng.chance(0.42 + Math.min(0.3, state.reputation / 2000))) createOffer(state, rng);
  if (day % 7 === 1) weeklyBills(state);
  if (day % 7 === 1) refreshCandidates(state, rng);
  if (day >= state.market.nextAuctionDay) openAuction(state, rng);
  resolveAuctions(state);
  comebacks(state);
  events(state, rng);
  moraleAndQuits(state, rng);
  debtPressure(state, rng);
  projectFlags(state);
  empire(state);
  if (state.settings.autosave) state.flags.autosaveDue = true;
  notify(state, 'info', l10n(`День ${day}. ${state.weather.kind}, ${state.market.season}.`, `Day ${day}. ${state.weather.kind}, ${state.market.season}.`));
  for (const key of Object.keys(state.flags)) {
    if (key.startsWith('saleUntil:') && Number(state.flags[key]) <= state.clock.absolute) {
      const cat = key.split(':')[1];
      delete state.market.categoryMul[cat];
      delete state.flags[key];
    }
  }
}

function driftMarket(state: GameState, rng: RNG): void {
  state.market.index = Math.max(0.82, Math.min(1.22, state.market.index + rng.float(-0.03, 0.03)));
  for (const key of Object.keys(state.market.demand)) {
    state.market.demand[key] = Math.max(0.6, Math.min(1.4, state.market.demand[key] + rng.float(-0.05, 0.05)));
  }
  state.market.fuelPrice = Math.max(1.2, Math.min(2.6, state.market.fuelPrice + rng.float(-0.05, 0.06)));
  if (state.flags.shortageUntil && Number(state.flags.shortageUntil) <= state.clock.absolute) {
    state.market.categoryMul = {};
    state.market.deliveryMul = 1;
    delete state.flags.shortageUntil;
  }
}

function fillMarket(state: GameState, rng: RNG, initial: boolean): void {
  state.market.listings = state.market.listings.filter((l) => l.seller === 'player' || l.expiresAt > state.clock.absolute);
  const target = (initial ? 6 : 5) + Math.floor(state.reputation / 250);
  let guard = 0;
  while (state.market.listings.filter((l) => l.seller !== 'player').length < target && guard < 12) {
    guard += 1;
    const model = pickModel(state, rng, false);
    const neglect = rng.float(0.2, 0.85);
    const v = createVehicle(state, rng, {
      modelId: model.id,
      neglect,
      role: 'market',
      location: 'offsite',
      fraud: rng.chance(model.rarity === 'rare' ? 0.28 : 0.08),
    });
    const a = analyze(model, v, state.parts);
    const price = appraise(state, model, v, a);
    const asking = Math.round(price.market * rng.float(0.86, 1.18));
    v.purchasedPrice = asking;
    state.market.listings.push(listing(state, v, asking, rng.chance(0.35) ? 'dealer' : 'private', rng));
  }
  state.market.junk = state.market.junk.filter((l) => l.expiresAt > state.clock.absolute);
  while (state.market.junk.length < 3) {
    const model = pickModel(state, rng, true);
    const v = createVehicle(state, rng, {
      modelId: model.id,
      neglect: rng.float(0.75, 1),
      role: 'junk',
      location: 'offsite',
      missing: rng.chance(0.4) ? [rng.pick(['exhaust', 'seat_fr', 'bumper_f', 'headlight_l'])] : [],
      paint: rng.int(8, 36),
      dirt: rng.int(40, 90),
    });
    const asking = Math.round(appraise(state, model, v, analyze(model, v, state.parts)).market * rng.float(0.35, 0.6));
    v.purchasedPrice = asking;
    const row = listing(state, v, asking, 'junkyard', rng);
    row.id = uid(state, 'junk');
    state.market.junk.push(row);
  }
}

function pickModel(state: GameState, rng: RNG, junk: boolean) {
  const pool = MODELS.filter((m) => {
    if (junk) return m.rarity !== 'legendary' || state.reputation > 600;
    if (m.rarity === 'legendary') return state.reputation > 750 && rng.chance(0.15);
    if (m.rarity === 'rare') return state.reputation > 280;
    if (m.rarity === 'uncommon') return state.reputation > 40;
    return true;
  });
  return rng.pick(pool.length ? pool : MODELS.filter((m) => m.rarity === 'common'));
}

function listing(state: GameState, v: VehicleInstance, asking: number, seller: Listing['seller'], rng: RNG): Listing {
  const notes = [
    l10n('Хозяин клянётся, что обслуживал вовремя.', 'The owner swears it was serviced on time.'),
    l10n('Небольшая царапина, в остальном без вложений.', 'A small scratch, otherwise no money needed.'),
    l10n('Продают, потому что купили другую.', 'Selling because they bought another.'),
    l10n('Долго стояла. Заводится через раз, говорят.', 'It sat for a long time. They say it starts every other try.'),
  ];
  return {
    id: uid(state, 'list'),
    vehicleId: v.id,
    asking,
    seller,
    inspected: false,
    note: rng.pick(notes),
    listedAt: state.clock.absolute,
    expiresAt: state.clock.absolute + rng.int(3, 7) * 1440,
  };
}

function resolvePlayerSales(state: GameState, rng: RNG): void {
  for (const listing of [...state.market.listings]) {
    if (listing.seller !== 'player') continue;
    const v = state.vehicles.find((c) => c.id === listing.vehicleId);
    if (!v) {
      state.market.listings = state.market.listings.filter((l) => l.id !== listing.id);
      continue;
    }
    const fair = appraise(state, modelById(v.modelId), v, analyze(modelById(v.modelId), v, state.parts)).privateAsk;
    const chance = saleChance(listing.asking, fair, state.employees.some((e) => e.role === 'salesperson'), state.reputation);
    if (!rng.chance(chance)) continue;
    let price = listing.asking;
    if (v.trueOdometer > v.odometer * 1.3 && !state.flags[`disclosed:${v.id}`] && rng.chance(0.4)) {
      price = Math.round(price * 0.85);
      addRep(state, -14);
      toast(state, 'bad', l10n('Покупатель нашёл скрутку после сделки.', 'The buyer found the clocked miles after the sale.'));
      state.stats.comebacks += 1;
    } else addRep(state, 2);
    pay(state, price, 'sale', l10n(`Продажа ${modelById(v.modelId).model}`, `Sold ${modelById(v.modelId).model}`));
    state.stats.carsSold += 1;
    state.collectionSold.push({ modelId: v.modelId, vin: v.vin, price, at: state.clock.absolute });
    state.market.listings = state.market.listings.filter((l) => l.id !== listing.id);
    destroyVehicle(state, v.id);
    toast(state, 'good', l10n(`Объявление ушло за ${price} ¤.`, `The listing sold for ${price}.`));
  }
}

function rivalBuys(state: GameState, rng: RNG): void {
  for (const listing of [...state.market.listings]) {
    if (listing.seller === 'player') continue;
    const v = state.vehicles.find((c) => c.id === listing.vehicleId);
    if (!v) continue;
    const fair = appraise(state, modelById(v.modelId), v, analyze(modelById(v.modelId), v, state.parts)).market;
    if (listing.asking < fair * 0.84 && rng.chance(0.45)) {
      state.market.listings = state.market.listings.filter((l) => l.id !== listing.id);
      destroyVehicle(state, v.id);
      toast(state, 'warn', l10n('Мастерская «Ключ» перехватила дешёвый лот.', 'The Wrench shop snatched a cheap lot.'));
    }
  }
}

function expireOrders(state: GameState): void {
  for (const order of state.orders) {
    if (order.status === 'offered' && state.clock.absolute > order.createdAt + 1440) {
      order.status = 'expired';
      addRep(state, -1);
    }
    if (order.status === 'active' && state.clock.absolute > order.deadline + 60) {
      order.status = 'failed';
      state.stats.ordersFailed += 1;
      addRep(state, order.personality === 'vip' ? -14 : -8);
      if (order.vehicleId) destroyVehicle(state, order.vehicleId);
      toast(state, 'bad', l10n(`${order.customer} забрал машину. Срок вышел.`, `${order.customer} took the car back. The deadline passed.`));
    }
  }
}

function weeklyBills(state: GameState): void {
  const rent = rentOf(state);
  state.economy.weeklyRent = rent;
  const power = money(state.economy.powerBill + 30);
  state.economy.powerBill = 0;
  const wages = payroll(state);
  const report = weeklyReport(state);
  const profit = report.income - report.expense;
  const tax = profit > 0 ? money(profit * taxRate(state.meta.difficulty)) : 0;
  state.economy.taxDue = tax;
  const interest = money(state.economy.debt * state.economy.interestRate);
  if (interest > 0) {
    state.economy.debt += interest;
    addLedger(state, -interest, 'tax', l10n('Проценты по кредиту', 'Loan interest'));
  }
  const bill = (amount: number, category: string, text: Parameters<typeof addLedger>[3]) => {
    if (freeCash(state) >= amount) charge(state, amount, category, text);
    else {
      state.economy.cash -= amount;
      addLedger(state, -amount, category, text);
    }
  };
  bill(rent, 'rent', l10n('Аренда и содержание', 'Rent and upkeep'));
  bill(power, 'power', l10n('Электричество', 'Power'));
  if (wages > 0) {
    if (freeCash(state) >= wages) {
      charge(state, wages, 'salary', l10n('Зарплата за неделю', 'Weekly wages'));
      for (const e of state.employees) e.morale = Math.min(100, e.morale + 3);
    } else {
      for (const e of state.employees) e.morale = Math.max(0, e.morale - 18);
      toast(state, 'bad', l10n('Зарплату выплатить нечем.', 'Payroll cannot be met.'));
    }
  }
  if (tax > 0) bill(tax, 'tax', l10n('Налог недели', 'Weekly tax'));
  toast(state, 'warn', l10n(`Счета: аренда ${rent}, свет ${power}, налог ${tax}.`, `Bills: rent ${rent}, power ${power}, tax ${tax}.`));
}

function openAuction(state: GameState, rng: RNG): void {
  if (state.market.auctions.some((a) => !a.resolved)) return;
  const auction: Auction = {
    id: uid(state, 'auc'),
    startsAt: state.clock.absolute,
    endsAt: state.clock.absolute + 8 * 60,
    lots: [],
    resolved: false,
    title: l10n('Вечерний аукцион двора', 'Evening yard auction'),
  };
  for (let i = 0; i < 3; i++) {
    const rare = rng.chance(state.reputation > 500 ? 0.4 : 0.12);
    const model = rare ? rng.pick(MODELS.filter((m) => m.rarity !== 'common')) : pickModel(state, rng, true);
    const v = createVehicle(state, rng, {
      modelId: model.id,
      neglect: rng.float(0.45, 0.95),
      role: 'auction',
      location: 'offsite',
      fraud: rng.chance(0.3),
      missing: rng.chance(0.25) ? ['splitter'] : [],
    });
    const fair = appraise(state, model, v, analyze(model, v, state.parts)).market;
    const start = Math.round(fair * rng.float(0.35, 0.6));
    v.purchasedPrice = start;
    auction.lots.push({
      id: uid(state, 'lot'),
      vehicleId: v.id,
      currentBid: start,
      leader: 'none',
      aiMax: Math.round(fair * rng.float(0.7, 1.05)),
      inspected: false,
      history: [{ who: 'house', amount: start, at: state.clock.absolute }],
      hold: 0,
    });
  }
  state.market.auctions.unshift(auction);
  state.market.auctions = state.market.auctions.slice(0, 6);
  state.market.nextAuctionDay = Math.floor(state.clock.absolute / 1440) + 1 + 3;
  toast(state, 'info', l10n('Открыт аукцион. Три лота, восемь часов.', 'An auction is open. Three lots, eight hours.'));
}

function auctionTick(state: GameState, rng: RNG): void {
  for (const auction of state.market.auctions) {
    if (auction.resolved || state.clock.absolute < auction.startsAt) continue;
    if (state.clock.absolute >= auction.endsAt) continue;
    for (const lot of auction.lots) {
      if (lot.currentBid >= lot.aiMax) continue;
      if (lot.leader === 'ai' && rng.chance(0.5)) continue;
      if (!rng.chance(0.55)) continue;
      const next = Math.min(lot.aiMax, Math.round(lot.currentBid * rng.float(1.04, 1.1) + 150));
      if (next <= lot.currentBid) continue;
      lot.currentBid = next;
      lot.leader = 'ai';
      lot.hold = 0;
      lot.history.push({ who: 'зал', amount: next, at: state.clock.absolute });
    }
  }
}

function resolveAuctions(state: GameState): void {
  for (const auction of state.market.auctions) {
    if (auction.resolved || state.clock.absolute < auction.endsAt) continue;
    auction.resolved = true;
    for (const lot of auction.lots) {
      const v = state.vehicles.find((c) => c.id === lot.vehicleId);
      if (lot.leader === 'player') {
        if (!hasSpace(state)) {
          lot.hold = 0;
          const fee = Math.round(lot.currentBid * 0.08);
          if (state.economy.cash >= fee) charge(state, fee, 'auction', l10n('Штраф организатора', 'Organizer fee'));
          toast(state, 'bad', l10n('Победа сорвана: нет места. Удержано вернулось, штраф списан.', 'Win voided: no space. The hold returned, the fee was charged.'));
          if (v) destroyVehicle(state, v.id);
          state.stats.auctionsLost += 1;
        } else if (v) {
          state.economy.cash = money(state.economy.cash - lot.hold);
          addLedger(state, -lot.hold, 'auction', l10n('Выигранный лот', 'Won lot'));
          lot.hold = 0;
          v.role = 'owned';
          v.location = 'yard';
          v.purchasedPrice = lot.currentBid;
          state.stats.auctionsWon += 1;
          state.stats.carsBought += 1;
          toast(state, 'good', l10n(`Лот ваш за ${lot.currentBid} ¤.`, `The lot is yours for ${lot.currentBid}.`));
        }
      } else {
        state.stats.auctionsLost += lot.history.some((h) => h.who === state.meta.boss) ? 1 : 0;
        if (v) destroyVehicle(state, v.id);
      }
    }
  }
}

function comebacks(state: GameState): void {
  for (const key of Object.keys(state.flags)) {
    if (!key.startsWith('comeback:')) continue;
    if (Number(state.flags[key]) > state.clock.absolute) continue;
    delete state.flags[key];
    const orderId = key.split(':')[1];
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) continue;
    const claw = money((order.score != null ? 1 - order.score : 0.4) * order.payoutBase * 0.35);
    if (claw > 0 && state.economy.cash >= claw) charge(state, claw, 'fine', l10n('Повторный визит', 'Comeback'));
    addRep(state, -6);
    state.stats.comebacks += 1;
    toast(state, 'bad', l10n(`${order.customer} вернулся. Работа не держалась.`, `${order.customer} came back. The work did not hold.`));
  }
}

function events(state: GameState, rng: RNG): void {
  if (state.events.some((e) => !e.resolved)) return;
  if (!rng.chance(0.5)) return;
  const day = Math.floor(state.clock.absolute / 1440) + 1;
  const roll = rng.int(0, 9);
  if (roll === 0) {
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'take-order',
      title: l10n('Срочный заказ', 'Urgent job'),
      text: l10n('Клиент платит сверху, если тормоза будут готовы очень быстро.', 'A customer will pay extra if the brakes are done very quickly.'),
      at: state.clock.absolute,
      until: state.clock.absolute + 720,
      resolved: false,
      choices: [
        { id: 'take', label: l10n('Взять заказ', 'Take the job') },
        { id: 'skip', label: l10n('Пропустить', 'Skip') },
      ],
      payload: { template: 'urgent_brakes' },
    });
  } else if (roll === 1 && day >= 4 && !state.stats.projectsFinished.length && !state.flags.projectSpawned) {
    state.flags.projectSpawned = true;
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'buy-project',
      title: l10n('Заброшенный спорткар', 'Abandoned sports car'),
      text: l10n('На свалке стоит Marcelli. Мотор почти мёртв, турбины нет, салон выпотрошен. Дёшево только сейчас.', 'A Marcelli sits in the junkyard. The engine is nearly dead, the turbo is gone, the cabin is gutted. It is cheap only today.'),
      at: state.clock.absolute,
      until: state.clock.absolute + 2000,
      resolved: false,
      choices: [
        { id: 'buy', label: l10n('Забрать за 4200', 'Take it for 4200') },
        { id: 'skip', label: l10n('Не сейчас', 'Not now') },
      ],
      payload: { project: 'abandoned-sport', price: 4200 },
    });
  } else if (roll === 2 && state.garage.upgrades.includes('lift')) {
    state.flags.liftBrokenUntil = state.clock.absolute + 900;
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'repair-lift',
      title: l10n('Подъёмник встал', 'Lift is down'),
      text: l10n('Гидравлика травит. Можно починить сразу или ждать до завтра.', 'The hydraulics are leaking. Fix it now or wait until tomorrow.'),
      at: state.clock.absolute,
      until: state.clock.absolute + 900,
      resolved: false,
      choices: [
        { id: 'fix', label: l10n('Починить за 380', 'Fix it for 380') },
        { id: 'wait', label: l10n('Подождать', 'Wait') },
      ],
    });
  } else if (roll === 3) {
    const cat = rng.pick(['brakes', 'engine', 'electrical', 'suspension']);
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'parts-sale',
      title: l10n('Выгодная партия', 'A cheap lot of parts'),
      text: l10n(`Склад предлагает скидку на категорию ${cat}.`, `A warehouse is discounting ${cat}.`),
      at: state.clock.absolute,
      until: state.clock.absolute + 600,
      resolved: false,
      choices: [
        { id: 'take', label: l10n('Взять скидку', 'Take the discount') },
        { id: 'skip', label: l10n('Мимо', 'Pass') },
      ],
      payload: { category: cat },
    });
  } else if (roll === 4) {
    const cat = rng.pick(['engine', 'electrical', 'body']);
    state.market.categoryMul[cat] = 1.75;
    state.market.deliveryMul = 1.8;
    state.flags.shortageUntil = state.clock.absolute + 3 * 1440;
    toast(state, 'warn', l10n(`Дефицит: ${cat}. Дороже и дольше.`, `Shortage: ${cat}. Dearer and slower.`));
  } else if (roll === 5 && state.reputation > 200) {
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'take-order',
      title: l10n('VIP у ворот', 'A VIP at the gate'),
      text: l10n('Дорогой клиент хочет цвет и тишину. Срок короткий, оплата выше.', 'A wealthy customer wants colour and quiet. The deadline is short and the pay is higher.'),
      at: state.clock.absolute,
      until: state.clock.absolute + 800,
      resolved: false,
      choices: [
        { id: 'take', label: l10n('Принять', 'Accept') },
        { id: 'skip', label: l10n('Отказать', 'Decline') },
      ],
      payload: { template: state.reputation > 650 ? 'race_prep' : 'paint_job' },
    });
  } else if (roll === 6) {
    state.market.fuelPrice = Math.min(2.8, state.market.fuelPrice * 1.25);
    toast(state, 'warn', l10n('Топливо подорожало.', 'Fuel got more expensive.'));
  } else if (roll === 7) {
    state.market.index = Math.max(0.8, state.market.index * 0.92);
    toast(state, 'info', l10n('Соседний сервис демпингует. Индекс рынка просел.', 'A rival shop is undercutting. The market index dipped.'));
  } else if (roll === 8 && day > 6) {
    state.events.unshift({
      id: uid(state, 'ev'),
      kind: 'buy-project',
      title: l10n('Классика из сарая', 'Barn classic'),
      text: l10n('Классику отдают почти даром. Кузов устал, история короткая.', 'A classic is almost being given away. The body is tired and the history is short.'),
      at: state.clock.absolute,
      until: state.clock.absolute + 1600,
      resolved: false,
      choices: [
        { id: 'buy', label: l10n('Забрать', 'Take it') },
        { id: 'skip', label: l10n('Не брать', 'Leave it') },
      ],
      payload: { project: 'barn-classic', price: 6100 },
    });
  } else {
    toast(state, 'info', l10n('Тихий день. Рынок просто дышит.', 'A quiet day. The market is just breathing.'));
  }
}

function moraleAndQuits(state: GameState, rng: RNG): void {
  for (const emp of [...state.employees]) {
    if (emp.morale < 25 && rng.chance(0.35)) {
      state.employees = state.employees.filter((e) => e.id !== emp.id);
      toast(state, 'bad', l10n(`${emp.name} ушёл без скандала, но без предупреждения.`, `${emp.name} left without a scene, and without notice.`));
    }
  }
}

function debtPressure(state: GameState, _rng: RNG): void {
  if (state.economy.cash >= 0) {
    state.economy.negativeSince = null;
    return;
  }
  if (state.economy.negativeSince == null) state.economy.negativeSince = state.clock.absolute;
  const days = (state.clock.absolute - state.economy.negativeSince) / 1440;
  toast(state, 'bad', l10n('Касса в минусе.', 'Cash is negative.'));
  if (days < 3) return;
  const victim = occupying(state)
    .filter((v) => v.role === 'owned' && !v.orderId)
    .sort((a, b) => b.purchasedPrice - a.purchasedPrice)[0];
  if (victim && days >= 3) {
    const price = Math.round(appraise(state, modelById(victim.modelId), victim, analyze(modelById(victim.modelId), victim, state.parts)).dealer * 0.7);
    pay(state, price, 'sale', l10n('Принудительная продажа', 'Forced sale'));
    destroyVehicle(state, victim.id);
    addRep(state, -10);
    toast(state, 'bad', l10n('Кредитор забрал машину.', 'A creditor took a car.'));
    if (state.economy.cash >= 0) state.economy.negativeSince = null;
    return;
  }
  if (days >= 7 && state.economy.cash < 0 && !occupying(state).some((v) => v.role === 'owned' && !v.orderId)) {
    state.meta.bankrupt = true;
    toast(state, 'bad', l10n('Мастерская банкрот. Можно загрузить слот или начать заново.', 'The shop is bankrupt. Load a slot or start again.'));
  }
}

function projectFlags(state: GameState): void {
  for (const v of state.vehicles) {
    if (!v.projectId || state.stats.projectsFinished.includes(v.id)) continue;
    const a = analyze(modelById(v.modelId), v, state.parts);
    const missing = Object.values(a.parts).some((p) => p.missing);
    if (!missing && a.start.fires && a.bodyScore >= 68 && v.paintCondition >= 70 && a.systems.engine >= 0.62) {
      state.stats.projectsFinished.push(v.id);
      addRep(state, 28);
      toast(state, 'good', l10n('Реставрация сошлась. Рынок это увидит в цене.', 'The restoration came together. The market will see it in the price.'));
    }
  }
}

function empire(state: GameState): void {
  if (state.meta.empireAnnounced) return;
  const threshold = state.meta.difficulty === 'easy' ? 250000 : state.meta.difficulty === 'hard' ? 750000 : 500000;
  const worth = netWorth(state);
  const bays = bayCount(state.garage.upgrades);
  if (
    worth >= threshold &&
    state.reputation >= 800 &&
    state.garage.upgrades.includes('showroom') &&
    bays >= 3 &&
    state.employees.length >= 4 &&
    state.stats.carsSold >= 8
  ) {
    state.meta.empireAnnounced = true;
    state.milestones.push({
      id: 'empire',
      at: state.clock.absolute,
      title: l10n('Автомобильная империя', 'Automotive empire'),
    });
    toast(state, 'good', l10n('Маленький бокс стал империей. Игра не заканчивается.', 'The small bay became an empire. The game does not end.'));
  }
}

export function netWorth(state: GameState): number {
  let cars = 0;
  for (const v of occupying(state)) {
    if (v.role !== 'owned') continue;
    cars += appraise(state, modelById(v.modelId), v, analyze(modelById(v.modelId), v, state.parts)).market;
  }
  const stock = state.garage.inventory.reduce((s, id) => s + (state.parts[id]?.purchasePrice ?? 0) * 0.45, 0);
  const gear = state.garage.upgrades.length * 4000 + state.garage.tools.length * 200;
  return Math.round(state.economy.cash + cars + stock + gear * 0.5 - state.economy.debt);
}

export function objectives(state: GameState): { ru: string; en: string }[] {
  const list: { ru: string; en: string }[] = [];
  const owned = state.vehicles.find((v) => v.role === 'owned');
  if (owned && owned.inspected.length < 2) {
    list.push({ ru: 'Откройте капот стартовой машины и осмотрите аккумулятор.', en: 'Open the starter car’s hood and inspect the battery.' });
  }
  if (state.orders.some((o) => o.status === 'offered')) {
    list.push({ ru: 'Посмотрите заказы. Масло — короткий путь к первым деньгам.', en: 'Read the jobs. Oil is a short path to the first cash.' });
  }
  if (state.orders.some((o) => o.status === 'active')) {
    list.push({ ru: 'Доведите заказ до зелёных требований и сдайте его из бокса.', en: 'Turn the job’s requirements green and deliver it from a bay.' });
  }
  if (!state.garage.upgrades.includes('lift') && state.economy.cash > 4300) {
    list.push({ ru: 'Подъёмник открывает днище. Без него коробка и поддон недоступны.', en: 'The lift opens the underside. Without it the gearbox and sump stay out of reach.' });
  }
  if (!list.length) list.push({ ru: 'Покупайте, чините, продавайте, расширяйте имя.', en: 'Buy, repair, sell, and grow the name.' });
  return list;
}

void capacity;
