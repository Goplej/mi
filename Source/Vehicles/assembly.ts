import type { L10n, ModelDef, PartSize, SlotSpec } from '../Core/types';
import { partType } from '../VehicleParts/catalog';

const CORNERS = ['fl', 'fr', 'rl', 'rr'] as const;

function slot(
  id: string,
  type: string,
  name: L10n,
  size: PartSize,
  extra: Partial<SlotSpec> = {},
): SlotSpec {
  const def = partType(type);
  return {
    id,
    type,
    group: def.group,
    name,
    size,
    tools: extra.tools ?? def.tools,
    minutes: extra.minutes ?? def.minutes,
    access: extra.access ?? {},
    optional: extra.optional,
    system: def.system,
    corner: extra.corner,
  };
}

export function expectedSlots(model: ModelDef): SlotSpec[] {
  const size = model.size;
  const electric = model.powertrain === 'electric';
  const turbo = model.engine.aspiration === 'turbo' || model.engine.aspiration === 'twin-turbo';
  const doors = model.doors >= 4 ? ['fl', 'fr', 'rl', 'rr'] : ['fl', 'fr'];
  const out: SlotSpec[] = [];

  out.push(slot('hood', 'hood', { ru: 'Капот', en: 'Hood' }, size, { access: {} }));
  out.push(slot('trunk', 'trunk', { ru: 'Багажник', en: 'Trunk lid' }, size, { access: {} }));
  out.push(slot('bumper_f', 'bumper', { ru: 'Передний бампер', en: 'Front bumper' }, size));
  out.push(slot('bumper_r', 'bumper', { ru: 'Задний бампер', en: 'Rear bumper' }, size));
  for (const d of doors) {
    out.push(
      slot(`door_${d}`, 'door', { ru: `Дверь ${d.toUpperCase()}`, en: `Door ${d.toUpperCase()}` }, size, {
        corner: d,
      }),
    );
  }
  for (const c of CORNERS) {
    out.push(
      slot(`fender_${c}`, 'fender', { ru: `Крыло ${c.toUpperCase()}`, en: `Fender ${c.toUpperCase()}` }, size, {
        corner: c,
      }),
    );
  }
  out.push(slot('roof', 'roof', { ru: 'Крыша', en: 'Roof' }, size, { tools: ['welder'] }));
  out.push(slot('windshield', 'windshield', { ru: 'Лобовое стекло', en: 'Windshield' }, size));
  out.push(slot('headlight_l', 'headlight', { ru: 'Фара левая', en: 'Left headlight' }, size));
  out.push(slot('headlight_r', 'headlight', { ru: 'Фара правая', en: 'Right headlight' }, size));
  out.push(slot('taillight_l', 'taillight', { ru: 'Фонарь левый', en: 'Left taillight' }, size));
  out.push(slot('taillight_r', 'taillight', { ru: 'Фонарь правый', en: 'Right taillight' }, size));
  out.push(slot('mirror_l', 'mirror', { ru: 'Зеркало левое', en: 'Left mirror' }, size));
  out.push(slot('mirror_r', 'mirror', { ru: 'Зеркало правое', en: 'Right mirror' }, size));
  out.push(
    slot('wing', 'wing', { ru: 'Антикрыло', en: 'Wing' }, size, {
      optional: true,
      access: { removed: [] },
    }),
  );
  out.push(slot('splitter', 'splitter', { ru: 'Сплиттер', en: 'Splitter' }, size, { optional: true }));

  out.push(slot('seat_fl', 'seat', { ru: 'Сиденье водителя', en: 'Driver seat' }, size, { access: { panel: 'door' } }));
  out.push(slot('seat_fr', 'seat', { ru: 'Сиденье пассажира', en: 'Passenger seat' }, size, { access: { panel: 'door' } }));
  out.push(slot('dashboard', 'dashboard', { ru: 'Панель приборов', en: 'Dashboard' }, size, { access: { panel: 'door' } }));
  out.push(slot('steeringWheel', 'steeringWheel', { ru: 'Руль', en: 'Steering wheel' }, size, { access: { panel: 'door' } }));

  for (const c of CORNERS) {
    const up = c.toUpperCase();
    out.push(
      slot(`wheel_${c}`, 'wheel', { ru: `Колесо ${up}`, en: `Wheel ${up}` }, size, {
        corner: c,
        access: { jackCorner: c },
        tools: ['jack'],
      }),
    );
    out.push(
      slot(`caliper_${c}`, 'caliper', { ru: `Суппорт ${up}`, en: `Caliper ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`wheel_${c}`] },
      }),
    );
    out.push(
      slot(`brakeDisc_${c}`, 'brakeDisc', { ru: `Диск ${up}`, en: `Disc ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`wheel_${c}`, `caliper_${c}`] },
      }),
    );
    out.push(
      slot(`brakePad_${c}`, 'brakePad', { ru: `Колодки ${up}`, en: `Pads ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`wheel_${c}`, `caliper_${c}`] },
      }),
    );
    out.push(
      slot(`shock_${c}`, 'shock', { ru: `Амортизатор ${up}`, en: `Shock ${up}` }, size, {
        corner: c,
        access: { jackCorner: c },
      }),
    );
    out.push(
      slot(`spring_${c}`, 'spring', { ru: `Пружина ${up}`, en: `Spring ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`shock_${c}`] },
      }),
    );
    out.push(
      slot(`arm_${c}`, 'arm', { ru: `Рычаг ${up}`, en: `Arm ${up}` }, size, {
        corner: c,
        access: { lift: true },
      }),
    );
    out.push(
      slot(`hub_${c}`, 'hub', { ru: `Ступица ${up}`, en: `Hub ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`wheel_${c}`, `brakeDisc_${c}`] },
      }),
    );
    out.push(
      slot(`bearing_${c}`, 'bearing', { ru: `Подшипник ${up}`, en: `Bearing ${up}` }, size, {
        corner: c,
        access: { jackCorner: c, removed: [`wheel_${c}`, `hub_${c}`] },
      }),
    );
  }
  out.push(slot('swayBar', 'swayBar', { ru: 'Стабилизатор', en: 'Sway bar' }, size, { access: { lift: true } }));
  out.push(slot('brakeLines', 'brakeLines', { ru: 'Тормозные магистрали', en: 'Brake lines' }, size, { access: { lift: true } }));
  out.push(slot('brakeFluid', 'brakeFluid', { ru: 'Тормозная жидкость', en: 'Brake fluid' }, size, { access: { panel: 'hood' } }));

  if (!electric) {
    out.push(slot('battery', 'battery', { ru: 'Аккумулятор', en: 'Battery' }, size, { access: { panel: 'hood' } }));
    out.push(slot('alternator', 'alternator', { ru: 'Генератор', en: 'Alternator' }, size, { access: { panel: 'hood', removed: ['belts'] } }));
    out.push(slot('starter', 'starter', { ru: 'Стартер', en: 'Starter' }, size, { access: { lift: true } }));
    out.push(slot('sparkPlugs', 'sparkPlugs', { ru: 'Свечи', en: 'Spark plugs' }, size, { access: { panel: 'hood' } }));
    out.push(slot('ignitionCoils', 'ignitionCoils', { ru: 'Катушки', en: 'Ignition coils' }, size, { access: { panel: 'hood' } }));
    out.push(slot('injectors', 'injectors', { ru: 'Форсунки', en: 'Injectors' }, size, { access: { panel: 'hood', removed: ['intake'] } }));
    out.push(slot('airFilter', 'airFilter', { ru: 'Воздушный фильтр', en: 'Air filter' }, size, { access: { panel: 'hood' } }));
    out.push(slot('intake', 'intake', { ru: 'Впуск', en: 'Intake' }, size, { access: { panel: 'hood' } }));
    out.push(slot('throttleBody', 'throttleBody', { ru: 'Дроссель', en: 'Throttle body' }, size, { access: { panel: 'hood' } }));
    out.push(slot('fuelPump', 'fuelPump', { ru: 'Топливный насос', en: 'Fuel pump' }, size, { access: { lift: true } }));
    out.push(slot('fuelTank', 'fuelTank', { ru: 'Топливный бак', en: 'Fuel tank' }, size, { access: { lift: true } }));
    out.push(slot('fuelLines', 'fuelLines', { ru: 'Топливные магистрали', en: 'Fuel lines' }, size, { access: { lift: true } }));
    out.push(slot('oilFilter', 'oilFilter', { ru: 'Масляный фильтр', en: 'Oil filter' }, size, { access: { panel: 'hood', jackCorner: 'fl' } }));
    out.push(slot('oil', 'oil', { ru: 'Моторное масло', en: 'Engine oil' }, size, { access: { panel: 'hood', jackCorner: 'fl' } }));
    out.push(slot('oilPan', 'oilPan', { ru: 'Поддон', en: 'Oil pan' }, size, { access: { lift: true } }));
    out.push(slot('radiator', 'radiator', { ru: 'Радиатор', en: 'Radiator' }, size, { access: { panel: 'hood', removed: ['bumper_f'] } }));
    out.push(slot('waterPump', 'waterPump', { ru: 'Помпа', en: 'Water pump' }, size, { access: { panel: 'hood', removed: ['belts'] } }));
    out.push(slot('thermostat', 'thermostat', { ru: 'Термостат', en: 'Thermostat' }, size, { access: { panel: 'hood' } }));
    out.push(slot('coolant', 'coolant', { ru: 'Антифриз', en: 'Coolant' }, size, { access: { panel: 'hood' } }));
    out.push(slot('fan', 'fan', { ru: 'Вентилятор', en: 'Fan' }, size, { access: { panel: 'hood' } }));
    out.push(slot('valveCover', 'valveCover', { ru: 'Клапанная крышка', en: 'Valve cover' }, size, { access: { panel: 'hood' } }));
    out.push(
      slot('cylinderHead', 'cylinderHead', { ru: 'Головка блока', en: 'Cylinder head' }, size, {
        access: { panel: 'hood', removed: ['valveCover', 'intake', 'exhaustManifold'] },
      }),
    );
    out.push(
      slot('headGasket', 'headGasket', { ru: 'Прокладка ГБЦ', en: 'Head gasket' }, size, {
        access: { removed: ['cylinderHead'] },
      }),
    );
    out.push(
      slot('camshaft', 'camshaft', { ru: 'Распредвал', en: 'Camshaft' }, size, {
        access: { removed: ['valveCover'] },
      }),
    );
    out.push(
      slot('valves', 'valves', { ru: 'Клапаны', en: 'Valves' }, size, {
        access: { removed: ['cylinderHead'] },
      }),
    );
    out.push(
      slot('pistons', 'pistons', { ru: 'Поршни', en: 'Pistons' }, size, {
        access: { removed: ['cylinderHead', 'oilPan'] },
      }),
    );
    out.push(
      slot('crankshaft', 'crankshaft', { ru: 'Коленвал', en: 'Crankshaft' }, size, {
        access: { removed: ['pistons', 'oilPan'] },
      }),
    );
    out.push(
      slot('engineBlock', 'engineBlock', { ru: 'Блок цилиндров', en: 'Engine block' }, size, {
        access: {
          panel: 'hood',
          removed: ['intake', 'radiator', 'exhaustManifold', 'alternator', 'gearbox'],
        },
        tools: ['wrench', 'hoist'],
      }),
    );
    out.push(slot('belts', 'belts', { ru: 'Ремни', en: 'Belts' }, size, { access: { panel: 'hood' } }));
    out.push(slot('exhaustManifold', 'exhaustManifold', { ru: 'Коллектор', en: 'Exhaust manifold' }, size, { access: { panel: 'hood' } }));
    out.push(slot('exhaust', 'exhaust', { ru: 'Выхлоп', en: 'Exhaust' }, size, { access: { lift: true } }));
    if (turbo) {
      out.push(slot('turbo', 'turbo', { ru: 'Турбина', en: 'Turbo' }, size, { access: { lift: true, removed: ['exhaustManifold'] } }));
      out.push(slot('intercooler', 'intercooler', { ru: 'Интеркулер', en: 'Intercooler' }, size, { access: { panel: 'hood', removed: ['bumper_f'] } }));
    }
    const clutchName = model.gearbox === 'manual' ? { ru: 'Сцепление', en: 'Clutch' } : { ru: 'Гидротрансформатор', en: 'Torque converter' };
    out.push(slot('clutch', 'clutch', clutchName, size, { access: { lift: true, removed: ['gearbox'] } }));
    out.push(slot('flywheel', 'flywheel', { ru: 'Маховик', en: 'Flywheel' }, size, { access: { lift: true, removed: ['gearbox', 'clutch'] } }));
    out.push(slot('gearbox', 'gearbox', { ru: 'Коробка передач', en: 'Gearbox' }, size, { access: { lift: true, removed: ['exhaust'] }, tools: ['wrench', 'hoist'] }));
    out.push(slot('transFluid', 'transFluid', { ru: 'Масло КПП', en: 'Gearbox oil' }, size, { access: { lift: true } }));
  } else {
    out.push(slot('batteryPack', 'batteryPack', { ru: 'Тяговая батарея', en: 'Traction battery' }, size === 'light' ? 'medium' : size, { access: { lift: true }, tools: ['wrench', 'hoist'] }));
    out.push(slot('inverter', 'inverter', { ru: 'Инвертор', en: 'Inverter' }, size === 'light' ? 'medium' : size, { access: { panel: 'hood' } }));
    out.push(slot('motor', 'motor', { ru: 'Электромотор', en: 'Motor' }, size === 'light' ? 'medium' : size, { access: { lift: true }, tools: ['wrench', 'hoist'] }));
    out.push(slot('bms', 'bms', { ru: 'BMS', en: 'BMS' }, size === 'light' ? 'medium' : size, { access: { lift: true, removed: ['batteryPack'] } }));
    out.push(slot('chargePort', 'chargePort', { ru: 'Зарядный порт', en: 'Charge port' }, size === 'light' ? 'medium' : size, { access: { panel: 'hood' } }));
    out.push(slot('isolation', 'isolation', { ru: 'Изоляция ВВ', en: 'HV isolation' }, size === 'light' ? 'medium' : size, { access: { lift: true } }));
    out.push(slot('coolant', 'coolant', { ru: 'Охлаждение батареи', en: 'Battery coolant' }, size, { access: { panel: 'hood' } }));
    out.push(slot('radiator', 'radiator', { ru: 'Радиатор контура', en: 'Cooling radiator' }, size, { access: { panel: 'hood', removed: ['bumper_f'] } }));
    out.push(slot('gearbox', 'gearbox', { ru: 'Редуктор', en: 'Reduction gear' }, size, { access: { lift: true }, tools: ['wrench', 'hoist'] }));
  }

  out.push(slot('differential', 'differential', { ru: 'Дифференциал', en: 'Differential' }, size, { access: { lift: true } }));
  out.push(slot('axles', 'axles', { ru: 'Приводы', en: 'Axles' }, size, { access: { lift: true } }));
  out.push(slot('ecu', 'ecu', { ru: 'ECU', en: 'ECU' }, size, { access: { panel: 'hood' } }));
  out.push(slot('wiring', 'wiring', { ru: 'Проводка', en: 'Wiring' }, size, { access: { panel: 'hood' } }));
  out.push(slot('sensors', 'sensors', { ru: 'Датчики', en: 'Sensors' }, size, { access: { panel: 'hood' } }));

  return out;
}

const cache = new Map<string, SlotSpec[]>();

export function slotsFor(model: ModelDef): SlotSpec[] {
  const hit = cache.get(model.id);
  if (hit) return hit;
  const built = expectedSlots(model);
  cache.set(model.id, built);
  return built;
}

export function slotById(model: ModelDef, id: string): SlotSpec | undefined {
  return slotsFor(model).find((s) => s.id === id);
}

export function systemOfSlot(id: string, model: ModelDef): string {
  return slotById(model, id)?.system ?? 'body';
}
