import { Game } from '../Source/Game/game';
import { actions } from '../Source/Game/game';
import { importState, exportState } from '../Source/SaveSystem/save';
import { simulateSprint, buildPowertrain, weatherMu } from '../Source/Physics/dynamics';
import { analyze } from '../Source/Vehicles/analysis';
import { modelById } from '../Source/Vehicles/models';
import { gradeOrder } from '../Source/Orders/logic';
import { quotesForSlot } from '../Source/Market/offers';
import { fitsVehicle } from '../Source/VehicleParts/build';
import { slotById } from '../Source/Vehicles/assembly';

let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed += 1;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

const game = Game.create({ company: 'Северный гараж', boss: 'Илья', difficulty: 'normal', seed: 42, lang: 'ru' });
const s = game.state;
check('starter cash', s.economy.cash === 8500, String(s.economy.cash));
check('starter car', s.vehicles.some((v) => v.modelId === 'drava-kombi' && v.location === 'bay:0'));
check('hidden faults', s.vehicles[0].inspected.length === 0);
check('offers exist', s.orders.some((o) => o.status === 'offered'));
check('market listings', s.market.listings.length >= 4, String(s.market.listings.length));
check('tools', s.garage.tools.includes('wrench') && s.garage.tools.includes('jack'));

const car = s.vehicles.find((v) => v.role === 'owned')!;
const before = analyze(modelById(car.modelId), car, s.parts);
check('starter does not fire cleanly', !before.start.fires, JSON.stringify(before.start.reasons));
check('battery is weak', (s.parts[car.slots.battery!]?.condition ?? 100) < 30);

const blocked = actions.requestRemove(s, car.id, 'brakeDisc_fl');
check('disc blocked without wheel off', !blocked.ok, blocked.message?.ru);

actions.toggleHood(s, car.id);
const inspect = actions.requestInspect(s, car.id, 'battery');
check('inspect scheduled', inspect.ok);
game.advance(30);
check('battery inspected', car.inspected.includes('battery'));

const offer = quotesForSlot(s, car, 'battery').find((o) => o.quality === 'aftermarket')!;
const cashBefore = s.economy.cash;
const bought = actions.orderPart(s, car.id, 'battery', 'aftermarket', true);
check('battery ordered', bought.ok, bought.message?.ru);
game.advance(offer.deliveryHours * 60 + 5);
const fresh = s.garage.inventory.map((id) => s.parts[id]).find((p) => p?.type === 'battery');
check('battery arrived', !!fresh, `cash ${cashBefore} -> ${s.economy.cash} inv ${s.garage.inventory.length}`);

actions.requestRemove(s, car.id, 'battery');
game.advance(40);
check('old battery removed', car.slots.battery == null);
if (fresh) {
  const inst = actions.requestInstall(s, car.id, 'battery', fresh.uid);
  check('install scheduled', inst.ok, inst.message?.ru);
  game.advance(40);
  check('new battery installed', car.slots.battery === fresh.uid);
}

const plugs = s.parts[car.slots.sparkPlugs!];
if (plugs && plugs.condition < 40) {
  actions.requestRemove(s, car.id, 'sparkPlugs');
  game.advance(40);
  actions.orderPart(s, car.id, 'sparkPlugs', 'aftermarket', true);
  game.advance(400);
  const np = s.garage.inventory.map((id) => s.parts[id]).find((p) => p?.type === 'sparkPlugs');
  if (np) {
    actions.requestInstall(s, car.id, 'sparkPlugs', np.uid);
    game.advance(40);
  }
}
actions.orderPart(s, car.id, 'oil', 'aftermarket', true);
actions.orderPart(s, car.id, 'oilFilter', 'aftermarket', true);
game.advance(500);
for (const slot of ['oil', 'oilFilter'] as const) {
  if (car.slots[slot]) {
    actions.requestRemove(s, car.id, slot);
    game.advance(40);
  }
  const part = s.garage.inventory.map((id) => s.parts[id]).find((p) => p?.type === slot && !p.installedIn);
  if (part) {
    actions.requestInstall(s, car.id, slot, part.uid);
    game.advance(50);
  }
}
actions.toggleLift(s, car.id);
const liftedStart = actions.tryStart(s, car.id);
const after = analyze(modelById(car.modelId), car, s.parts);
check('engine can start after service', after.start.fires && liftedStart.ok, liftedStart.message?.ru + ' ' + after.start.reasons.map((r) => r.ru).join(';'));

const order = s.orders.find((o) => o.templateId === 'oil_service' && o.status === 'offered');
check('oil order offered', !!order);
if (order) {
  actions.requestMove(s, car.id, 'parking');
  game.advance(10);
  const rng = game.rng();
  const accepted = actions.acceptJob(s, rng, order.id);
  game.commitRng(rng);
  check('order accepted', accepted.ok, accepted.message?.ru);
  const customer = s.vehicles.find((v) => v.orderId === order.id);
  check('customer car in yard', customer?.location === 'yard');
  if (customer) {
    actions.requestMove(s, customer.id, 'bay:0');
    game.advance(10);
    actions.toggleHood(s, customer.id);
    actions.toggleJack(s, customer.id, 'fl');
    for (const slot of ['oil', 'oilFilter']) {
      if (!(slot in customer.slots)) continue;
      actions.orderPart(s, customer.id, slot, 'aftermarket', true);
      game.advance(400);
      if (customer.slots[slot]) {
        actions.requestRemove(s, customer.id, slot);
        game.advance(40);
      }
      const spec = slotById(modelById(customer.modelId), slot)!;
      const part = s.garage.inventory
        .map((id) => s.parts[id])
        .filter((p) => p && fitsVehicle(p, spec.type, spec.size, modelById(customer.modelId).brand) && !p.installedIn)
        .sort((a, b) => b!.condition - a!.condition)[0];
      if (part) {
        const inst = actions.requestInstall(s, customer.id, slot, part.uid);
        if (!inst.ok) throw new Error(inst.message?.ru ?? 'install');
        game.advance(50);
      } else {
        throw new Error(`no compatible ${slot} for ${customer.modelId} ${spec.size}`);
      }
    }
    const grade = gradeOrder(s, order, customer);
    check('oil outcomes met', grade.lines.every((l) => l.ok), grade.lines.map((l) => `${l.id}:${l.ok}`).join(','));
    const cash = s.economy.cash;
    const delivered = actions.deliverJob(s, order.id);
    check('job delivered', delivered.ok && s.economy.cash > cash, `${cash} -> ${s.economy.cash} ${delivered.message?.ru}`);
    check('reputation moved', s.reputation !== 36, String(s.reputation));
  }
}

const healthy = analyze(modelById('nordheim-rs'), {
  ...car,
  modelId: 'nordheim-rs',
  slots: car.slots,
  tune: { ecuPower: 0, ride: 0, aero: 0 },
  fuel: 1,
  runtime: { running: false, rpm: 0, temp: 20, throttle: 0 },
}, s.parts);
void healthy;
const rs = modelById('nordheim-rs');
const kombi = modelById('drava-kombi');
const fakeHealthy = (modelId: string) => {
  const model = modelById(modelId);
  const analysis = analyze(model, {
    ...car,
    modelId,
    fuel: 1,
    tune: { ecuPower: 0, ride: 0, aero: 0 },
    slots: Object.fromEntries(Object.keys(car.slots).map((k) => [k, car.slots[k]])),
  }, s.parts);
  analysis.powerHp = model.engine.power;
  analysis.torqueNm = model.engine.torque;
  analysis.grip = 1.1;
  analysis.wetGrip = 0.9;
  analysis.brake = 1;
  analysis.cooling = 1;
  analysis.mass = model.mass;
  analysis.drag = model.drag;
  analysis.misfire = 0;
  analysis.systems.transmission = 1;
  return buildPowertrain(model, analysis, 0);
};
const fast = simulateSprint(fakeHealthy('nordheim-rs'), 'clear');
const slow = simulateSprint(fakeHealthy('drava-kombi'), 'clear');
check('sports car is quicker', (fast.zeroTo100 ?? 99) < (slow.zeroTo100 ?? 0), `rs ${fast.zeroTo100} kombi ${slow.zeroTo100}`);
check('rain grip lower', weatherMu('heavy-rain') < weatherMu('clear'));
void rs;
void kombi;

const raw = exportState(s);
const loaded = importState(raw);
check('save roundtrip cash', loaded.economy.cash === s.economy.cash);
check('save roundtrip cars', loaded.vehicles.length === s.vehicles.length);
check('save rejects bad version', (() => { try { importState('{"version":99,"state":{}}'); return false; } catch { return true; } })());

game.advance(8 * 1440);
check('time advanced a week', s.clock.absolute > 8 * 1440);
check('rent happened or ledger grew', s.economy.ledger.length > 3, String(s.economy.ledger.length));

console.log(failed ? `\n${failed} checks failed` : '\nAll simulation checks passed');
if (failed) throw new Error(`${failed} checks failed`);
