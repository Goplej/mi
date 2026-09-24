import type { Game } from '../Game/game';
import type { GameState, Lang, Quality, VehicleInstance } from '../Core/types';
import { clockParts, escapeHtml, formatMoney, tr } from '../Core/util';
import { creditLimit } from '../Economy/economy';
import { gradeOrder } from '../Orders/logic';
import { quotesForSlot } from '../Market/offers';
import { listSlots, loadSettings } from '../SaveSystem/save';
import { TOOLS, UPGRADES, bayCount } from '../Tools/definitions';
import { accessProblem } from '../Game/access';
import { PART_GROUPS } from '../VehicleParts/catalog';
import { fitsVehicle } from '../VehicleParts/build';
import { slotsFor } from '../Vehicles/assembly';
import { modelById } from '../Vehicles/models';
import { POIS, travelMinutes } from '../World/city';
import type { Session } from './session';

export interface Ctx {
  game: Game | null;
  session: Session;
  lang: Lang;
}

const Q: Quality[] = ['used', 'aftermarket', 'oem', 'performance', 'racing'];

export function say(lang: Lang, ru: string, en: string): string {
  return lang === 'en' ? en : ru;
}

function e(s: string): string {
  return escapeHtml(s);
}

function btn(cmd: string, args: unknown[], label: string, cls = 'btn'): string {
  return `<button type="button" class="${cls}" data-cmd="${e(cmd)}" data-a="${e(JSON.stringify(args))}">${label}</button>`;
}

function money(n: number, lang: Lang): string {
  return e(formatMoney(n, lang));
}

function carLabel(v: VehicleInstance, lang: Lang): string {
  const m = modelById(v.modelId);
  return `${m.brand} ${m.model} · ${v.year}`;
}

export function menuHtml(ctx: Ctx): string {
  const lang = ctx.lang;
  const screen = ctx.session.menu;
  const slots = listSlots();
  const hasSave = slots.some((s) => !s.empty);
  if (screen === 'new') return newGame(lang);
  if (screen === 'load') return loadScreen(lang, false);
  if (screen === 'settings') return settingsScreen(ctx, true);
  if (screen === 'credits') return credits(lang);
  if (screen === 'exit') return exitScreen(lang);
  const items: [string, string, string, boolean?][] = [
    ['continue', 'Continue', say(lang, 'Последнее сохранение', 'Latest save'), !hasSave],
    ['new', 'New Game', say(lang, 'Пустой бокс и старая машина', 'An empty bay and an old car')],
    ['load', 'Load Game', say(lang, 'Шесть слотов', 'Six slots')],
    ['settings', 'Settings', say(lang, 'Язык, звук, картинка', 'Language, sound, picture')],
    ['credits', 'Credits', say(lang, 'Кто собрал мастерскую', 'Who built the shop')],
    ['exit', 'Exit', say(lang, 'Закрыть смену', 'Close the shift')],
  ];
  return `<div class="menu">
    <div class="menu-card">
      <p class="eyebrow">restoration · workshop · empire</p>
      <h1 class="brand">GARAGE EMPIRE</h1>
      <p class="tagline">${e(say(lang, 'Маленький бокс, старая машина, мало денег. Имя на воротах ещё впереди.', 'A small bay, an old car, and not much cash. The name on the door is still ahead.'))}</p>
      <nav class="menu-list">
        ${items
          .map(
            ([id, en, sub, off]) =>
              `<button type="button" class="menu-btn" data-cmd="menu" data-a="${e(JSON.stringify([id]))}" ${off ? 'disabled' : ''}>
                <span class="menu-en">${en}</span><span class="menu-sub">${e(sub)}</span>
              </button>`,
          )
          .join('')}
      </nav>
      <p class="menu-foot">${e(say(lang, 'Вымышленные марки. Никаких чужих шильдиков.', 'Fictional marques. No borrowed badges.'))}</p>
    </div>
  </div>`;
}

function newGame(lang: Lang): string {
  return `<div class="menu"><div class="menu-card">
    <p class="eyebrow">New Game</p>
    <h1 class="brand">GARAGE EMPIRE</h1>
    <form class="form" id="new-form">
      <label class="field">${e(say(lang, 'Мастерская', 'Shop'))}<input id="co-name" maxlength="28" value="${lang === 'en' ? 'Bay One' : 'Первый бокс'}"></label>
      <label class="field">${e(say(lang, 'Хозяин', 'Owner'))}<input id="co-boss" maxlength="28" value="${lang === 'en' ? 'Alex' : 'Алекс'}"></label>
      <label class="field">${e(say(lang, 'Сложность', 'Difficulty'))}
        <select id="co-diff"><option value="easy">${e(say(lang, 'Легко — 20 000 ¤', 'Easy — 20,000'))}</option><option value="normal" selected>${e(say(lang, 'Нормально — 8 500 ¤', 'Normal — 8,500'))}</option><option value="hard">${e(say(lang, 'Жёстко — 4 500 ¤', 'Hard — 4,500'))}</option></select>
      </label>
      <label class="field">${e(say(lang, 'Язык', 'Language'))}<select id="co-lang"><option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></label>
      <label class="field">${e(say(lang, 'Зерно мира, 0 — случайное', 'World seed, 0 = random'))}<input id="co-seed" type="number" value="0"></label>
      ${btn('start-new', [], say(lang, 'Открыть ворота', 'Open the door'), 'btn primary')}
      ${btn('menu', ['main'], '← ' + say(lang, 'Назад', 'Back'))}
    </form>
  </div></div>`;
}

function loadScreen(lang: Lang, ingame: boolean): string {
  const wrap = (inner: string) =>
    ingame
      ? inner
      : `<div class="menu"><div class="menu-card"><p class="eyebrow">Load Game</p><h1 class="brand" style="font-size:36px">GARAGE EMPIRE</h1>${inner}${btn('menu', ['main'], '← ' + say(lang, 'Назад', 'Back'))}</div></div>`;
  const slots = listSlots()
    .map((s) => {
      if (s.empty) return `<div class="card"><div class="spread"><b>${s.slot === 0 ? say(lang, 'Авто', 'Auto') : say(lang, 'Слот', 'Slot') + ' ' + s.slot}</b><span class="muted">${e(say(lang, 'пусто', 'empty'))}</span></div></div>`;
      return `<div class="card"><div class="spread"><b>${e(s.company ?? '')}</b><span>${money(s.cash ?? 0, lang)}</span></div>
        <div class="small muted">${e(say(lang, 'День', 'Day'))} ${s.day} · ${e(say(lang, 'репутация', 'reputation'))} ${Math.round(s.reputation ?? 0)}</div>
        <div class="row">${btn('load-slot', [s.slot], say(lang, 'Загрузить', 'Load'), 'btn primary')}${s.slot ? btn('delete-slot', [s.slot], say(lang, 'Стереть', 'Erase'), 'btn danger') : ''}</div></div>`;
    })
    .join('');
  return wrap(`<div class="form">${slots}</div>`);
}

function settingsScreen(ctx: Ctx, menu: boolean): string {
  const lang = ctx.lang;
  const s = ctx.game?.state.settings ?? loadSettings();
  const body = `<div class="form">
    <label class="field">${e(say(lang, 'Язык', 'Language'))}<select data-set="lang"><option value="ru" ${s.lang === 'ru' ? 'selected' : ''}>Русский</option><option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option></select></label>
    <label class="field">${e(say(lang, 'Качество', 'Quality'))}<select data-set="quality"><option ${s.quality === 'low' ? 'selected' : ''}>low</option><option ${s.quality === 'medium' ? 'selected' : ''}>medium</option><option ${s.quality === 'high' ? 'selected' : ''}>high</option></select></label>
    ${slider(say(lang, 'Общая громкость', 'Master'), 'master', s.master)}
    ${slider(say(lang, 'Мотор', 'Engine'), 'engineVol', s.engineVol)}
    ${slider(say(lang, 'Цех', 'Shop'), 'ambience', s.ambience)}
    ${slider(say(lang, 'Интерфейс', 'Interface'), 'uiVol', s.uiVol)}
    <label class="row"><input type="checkbox" data-set="autosave" ${s.autosave ? 'checked' : ''}> ${e(say(lang, 'Автосохранение', 'Autosave'))}</label>
    <label class="row"><input type="checkbox" data-set="hints" ${s.hints ? 'checked' : ''}> ${e(say(lang, 'Подсказки', 'Hints'))}</label>
    <label class="row"><input type="checkbox" data-set="invert" ${s.invert ? 'checked' : ''}> ${e(say(lang, 'Инверсия руля', 'Invert steering'))}</label>
    <p class="small muted">${e(say(lang, 'WASD — газ, тормоз, руль. Пробел — ручник на трассе, пауза в боксе. F — свет. E — войти. Esc — меню.', 'WASD — throttle, brake, steer. Space — handbrake on the pad, pause in the bay. F — lights. E — enter. Esc — menu.'))}</p>
    ${menu ? btn('menu', ['main'], '← ' + say(lang, 'Назад', 'Back')) : ''}
  </div>`;
  return menu ? `<div class="menu"><div class="menu-card"><p class="eyebrow">Settings</p><h1 class="brand" style="font-size:36px">GARAGE EMPIRE</h1>${body}</div></div>` : body;
}

function slider(label: string, key: string, value: number): string {
  return `<label class="field">${e(label)}<input type="range" min="0" max="1" step="0.05" value="${value}" data-set="${key}"></label>`;
}

function credits(lang: Lang): string {
  return `<div class="menu"><div class="menu-card">
    <p class="eyebrow">Credits</p>
    <h1 class="brand" style="font-size:36px">GARAGE EMPIRE</h1>
    <div class="card"><p>${e(say(lang, 'Игра про мастерскую, а не про чужие марки. Drava, Vespera, Solara, Kaluga, Nordheim, Marcelli, Helix, Ashford, Aurion и Vektor выдуманы.', 'A shop game, not a badge game. Drava, Vespera, Solara, Kaluga, Nordheim, Marcelli, Helix, Ashford, Aurion and Vektor are invented.'))}</p>
    <p class="small muted">${e(say(lang, 'Симуляция износа, диагностика, рынок, заказы, штат и заезды связаны одним состоянием. Картинка собирается в браузере, без чужих моделей машин.', 'Wear, diagnostics, the market, jobs, staff and runs share one state. The picture is built in the browser, without borrowed car models.'))}</p></div>
    ${btn('menu', ['main'], '← ' + say(lang, 'Назад', 'Back'))}
  </div></div>`;
}

function exitScreen(lang: Lang): string {
  return `<div class="menu"><div class="menu-card">
    <p class="eyebrow">Exit</p>
    <h1 class="brand" style="font-size:36px">GARAGE EMPIRE</h1>
    <p>${e(say(lang, 'Смена закрыта. Окно можно закрыть.', 'The shift is closed. You can close the window.'))}</p>
    ${btn('menu', ['main'], say(lang, 'Вернуться', 'Return'))}
  </div></div>`;
}

export function panelHtml(ctx: Ctx): string {
  const game = ctx.game;
  if (!game) return '';
  const id = ctx.session.panel;
  if (!id) return '';
  const title = titleOf(id, ctx.lang);
  const body =
    id === 'workshop'
      ? workshop(ctx)
      : id === 'car'
        ? carPanel(ctx)
        : id === 'diag'
          ? diagPanel(ctx)
          : id === 'parts'
            ? partsPanel(ctx)
            : id === 'market'
              ? marketPanel(ctx)
              : id === 'auction'
                ? auctionPanel(ctx)
                : id === 'orders'
                  ? ordersPanel(ctx)
                  : id === 'staff'
                    ? staffPanel(ctx)
                    : id === 'finance'
                      ? financePanel(ctx)
                      : id === 'city'
                        ? cityPanel(ctx)
                        : id === 'progress'
                          ? progressPanel(ctx)
                          : id === 'tune'
                            ? tunePanel(ctx)
                            : id === 'saves'
                              ? loadScreen(ctx.lang, true) + saveButtons(ctx)
                              : id === 'settings'
                                ? settingsScreen(ctx, false)
                                : '';
  return `<aside class="panel"><header><h2>${e(title)}</h2><button type="button" class="close" data-cmd="close-panel" data-a="[]">×</button></header><div class="body">${body}</div></aside>`;
}

function titleOf(id: string, lang: Lang): string {
  const map: Record<string, [string, string]> = {
    workshop: ['Бокс', 'Bay'],
    car: ['Машина', 'Car'],
    diag: ['Диагностика', 'Diagnostics'],
    parts: ['Запчасти', 'Parts'],
    market: ['Рынок', 'Market'],
    auction: ['Аукцион', 'Auction'],
    orders: ['Заказы', 'Jobs'],
    staff: ['Штат', 'Staff'],
    finance: ['Касса', 'Books'],
    city: ['Город', 'City'],
    progress: ['Имя', 'Name'],
    tune: ['Настройка', 'Setup'],
    saves: ['Сохранения', 'Saves'],
    settings: ['Настройки', 'Settings'],
  };
  const pair = map[id] ?? [id, id];
  return say(lang, pair[0], pair[1]);
}

function workshop(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const objs = ctx.game!.objectives();
  const starter = s.vehicles.find((v) => v.role === 'owned');
  const active = s.orders.find((o) => o.status === 'active');
  const bays = bayCount(s.garage.upgrades);
  const cars = s.vehicles.filter((v) => v.location !== 'offsite');
  const work = s.work.active;
  return `${objs.map((o) => `<p class="objective">${e(tr(o, lang))}</p>`).join('')}
    <div class="row">
      ${starter && !starter.inspected.includes('battery') ? btn('focus-slot', [starter.id, 'battery', 'electrical'], say(lang, 'К аккумулятору', 'To the battery'), 'btn primary') : ''}
      ${active?.templateId === 'oil_service' ? btn('focus-slot', [active.vehicleId, 'oil', 'engine'], say(lang, 'К маслу заказа', 'To the job oil'), 'btn primary') : active ? btn('select-car', [active.vehicleId], say(lang, 'К машине заказа', 'To the job car'), 'btn primary') : ''}
    </div>
    <div class="card"><div class="spread"><b>${e(say(lang, 'Боксы', 'Bays'))}</b><span>${bays}</span></div>
    <div class="small muted">${e(say(lang, 'Парковка', 'Parking'))} ${s.garage.parking} · ${e(say(lang, 'склад', 'stock'))} ${s.garage.inventory.length}</div></div>
    ${cars.map((v) => `<div class="card ${ctx.session.selectedId === v.id ? 'on' : ''}"><div class="spread"><b>${e(carLabel(v, lang))}</b><span class="small">${e(v.location)}</span></div>
      <div class="small muted">${e(v.role)} · ${e(v.vin)}</div>
      <div class="row">${btn('select-car', [v.id], say(lang, 'Выбрать', 'Select'), 'btn primary')}${moveButtons(s, v, lang)}</div></div>`).join('')}
    ${work ? `<div class="card"><b>${e(tr(work.label, lang))}</b><div class="bar"><i style="width:${Math.round((1 - work.remaining / Math.max(1, work.total)) * 100)}%"></i></div>
      <div class="row">${btn('skip-work', [], say(lang, 'Дождаться конца', 'Wait it out'), 'btn primary')}${btn('cancelCurrent', [], say(lang, 'Отменить', 'Cancel'), 'btn danger')}</div></div>` : ''}
    <h3>${e(say(lang, 'Инструмент', 'Tools'))}</h3>
    ${TOOLS.map((t) => {
      const owned = s.garage.tools.includes(t.id);
      return `<div class="spread small"><span>${e(tr(t.name, lang))}</span>${owned ? `<span class="good">${e(say(lang, 'есть', 'owned'))}</span>` : btn('buyTool', [t.id], money(t.price, lang))}</div>`;
    }).join('')}
    <h3>${e(say(lang, 'Расширение', 'Expansion'))}</h3>
    ${UPGRADES.map((u) => {
      const owned = s.garage.upgrades.includes(u.id);
      const ready = u.requires.every((r) => s.garage.upgrades.includes(r) || s.garage.tools.includes(r));
      return `<div class="card"><div class="spread"><b>${e(tr(u.name, lang))}</b><span>${owned ? e(say(lang, 'стоит', 'built')) : money(u.price, lang)}</span></div>
        <div class="small muted">${e(tr(u.description, lang))}</div>
        ${owned ? '' : btn('buyUpgrade', [u.id], ready ? say(lang, 'Построить', 'Build') : say(lang, 'Рано', 'Not yet'), ready ? 'btn primary' : 'btn')}</div>`;
    }).join('')}
    ${s.garage.deliveries.length ? `<h3>${e(say(lang, 'В пути', 'Inbound'))}</h3>` + s.garage.deliveries.map((d) => `<div class="small">${e(tr(d.offer.name, lang))} · ${Math.max(0, Math.round(d.eta - s.clock.absolute))} ${e(say(lang, 'мин', 'min'))}</div>`).join('') + btn('wait-delivery', [], say(lang, 'Ждать поставку', 'Wait for the truck'), 'btn primary') : ''}`;
}

function freeBay(s: GameState): string | null {
  const n = bayCount(s.garage.upgrades);
  for (let i = 0; i < n; i++) {
    if (!s.vehicles.some((v) => v.location === `bay:${i}`)) return `bay:${i}`;
  }
  return null;
}

function moveButtons(s: GameState, v: VehicleInstance, lang: Lang): string {
  const bay = freeBay(s);
  const toBay = v.location.startsWith('bay:')
    ? ''
    : bay
      ? btn('requestMove', [v.id, bay], say(lang, 'В свободный бокс', 'Into a free bay'), 'btn primary')
      : `<span class="small warn">${e(say(lang, 'Бокс занят — сначала на парковку.', 'The bay is full — park the other car.'))}</span>`;
  const park = v.location === 'parking' ? '' : btn('requestMove', [v.id, 'parking'], say(lang, 'На парковку', 'To parking'));
  return toBay + park;
}

function selected(ctx: Ctx): VehicleInstance | null {
  const id = ctx.session.selectedId;
  return ctx.game?.state.vehicles.find((v) => v.id === id) ?? null;
}

function carPanel(ctx: Ctx): string {
  const v = selected(ctx);
  const lang = ctx.lang;
  const s = ctx.game!.state;
  if (!v) return `<p class="muted">${e(say(lang, 'Выберите машину в боксе или нажмите на неё.', 'Pick a car in the bay, or click it.'))}</p>` + workshopCars(ctx);
  const model = modelById(v.modelId);
  const analysis = ctx.game!.analysis(v.id);
  const slots = slotsFor(model).filter((slot) => ctx.session.group === 'all' || slot.group === ctx.session.group);
  const groups = [{ id: 'all', name: { ru: 'Все', en: 'All' } }, ...PART_GROUPS];
  return `<div class="spread"><div><b>${e(carLabel(v, lang))}</b><div class="small muted">${e(model.engine.arch)} · ${model.engine.power} ${e(say(lang, 'л.с.', 'hp'))} · ${e(v.location)}</div></div>
    <div class="small">${e(say(lang, 'топливо', 'fuel'))} ${Math.round(v.fuel * 100)}%</div></div>
    <div class="chips">${groups.map((g) => `<button type="button" class="chip ${ctx.session.group === g.id ? 'on' : ''}" data-cmd="set-group" data-a="${e(JSON.stringify([g.id]))}">${e(tr(g.name, lang))}</button>`).join('')}</div>
    <div class="row">
      ${btn('toggleHood', [v.id], v.panels.hood ? say(lang, 'Закрыть капот', 'Close hood') : say(lang, 'Открыть капот', 'Open hood'), 'btn primary')}
      ${btn('toggleTrunk', [v.id], say(lang, 'Багажник', 'Trunk'))}
      ${btn('toggleDoor', [v.id, 'fl'], say(lang, 'Дверь', 'Door'))}
      ${btn('toggleJack', [v.id, 'fl'], say(lang, 'Домкрат FL', 'Jack FL'))}
      ${btn('toggleJack', [v.id, 'fr'], 'FR')}
      ${btn('toggleJack', [v.id, 'rl'], 'RL')}
      ${btn('toggleJack', [v.id, 'rr'], 'RR')}
      ${btn('toggleLift', [v.id], say(lang, 'Подъёмник', 'Lift'))}
      ${btn('tryStart', [v.id], say(lang, 'Пуск', 'Start'), 'btn primary')}
      ${btn('stopEngine', [v.id], say(lang, 'Глушить', 'Stop'))}
      ${btn('requestWash', [v.id], say(lang, 'Мойка', 'Wash'))}
      ${btn('requestSand', [v.id], say(lang, 'Шлифовка', 'Sand'))}
      ${btn('refuel', [v.id, 'garage'], say(lang, 'Заправить', 'Fuel'))}
    </div>
    <div class="row">
      ${['#8d1d2c', '#1e3a5f', '#e4dcc8', '#1f6f4a', '#111111', '#c4552a'].map((c) => `<button type="button" class="chip" style="background:${c};width:28px;height:22px" data-cmd="requestPaint" data-a="${e(JSON.stringify([v.id, c, 'standard']))}" title="${c}"></button>`).join('')}
      ${btn('requestPaint', [v.id, v.color, 'pearl'], say(lang, 'Перламутр', 'Pearl'))}
      ${btn('setDisclosure', [v.id, true], say(lang, 'Честный пробег', 'Disclose mileage'))}
    </div>
    <div class="row">
      ${moveButtons(s, v, lang)}
      ${btn('requestMove', [v.id, 'yard'], say(lang, 'Двор', 'Yard'))}
      ${btn('open-panel', ['diag'], say(lang, 'Диагностика', 'Diagnose'))}
      ${btn('start-drive', ['track'], say(lang, 'Площадка', 'Test pad'), 'btn primary')}
      ${btn('start-drive', ['city'], say(lang, 'В город', 'Into town'))}
    </div>
    ${analysis ? `<div class="small muted">${analysis.canDrive ? e(say(lang, 'На ходу.', 'It can be driven.')) : e(tr(analysis.driveBlock ?? { ru: '', en: '' }, lang))} · ${Math.round(analysis.powerHp)} ${e(say(lang, 'л.с. сейчас', 'hp now'))}</div>` : ''}
    ${slots
      .map((slot) => {
        const uid = v.slots[slot.id];
        const part = uid ? s.parts[uid] : null;
        const known = v.inspected.includes(slot.id) || v.scanned;
        const cond = part ? Math.round(part.condition) : 0;
        const problem = accessProblem(s, v, slot.id, true);
        const fit = s.garage.inventory
          .map((id) => s.parts[id])
          .filter((p) => p && fitsVehicle(p, slot.type, slot.size, model.brand) && !p.installedIn)
          .sort((a, b) => b.condition - a.condition);
        return `<div class="slot ${ctx.session.selectedSlot === slot.id ? 'on' : ''}">
          <div><button type="button" class="chip" data-cmd="select-slot" data-a="${e(JSON.stringify([slot.id]))}">${e(tr(slot.name, lang))}</button>
            <div class="small muted">${known ? (part ? `${cond}% · ${e(part.quality)}` : e(say(lang, 'пусто', 'empty'))) : e(say(lang, 'не осмотрено', 'not inspected'))}</div>
            ${known && part ? `<div class="bar ${cond < 40 ? 'bad' : cond < 70 ? '' : 'good'}"><i style="width:${cond}%"></i></div>` : ''}
            ${problem ? `<div class="small warn">${e(tr(problem, lang))}</div>` : ''}
          </div>
          <div class="chips">
            ${btn('requestInspect', [v.id, slot.id], say(lang, 'Осмотр', 'Look'))}
            ${part ? btn('requestRemove', [v.id, slot.id], say(lang, 'Снять', 'Remove')) : ''}
            ${part && part.repairable ? btn('requestRepair', [v.id, slot.id], say(lang, 'Чинить', 'Repair')) : ''}
            ${fit[0] ? btn('requestInstall', [v.id, slot.id, fit[0].uid], say(lang, 'Поставить', 'Fit'), 'btn primary') : ''}
            ${btn('open-order', [slot.id], say(lang, 'Заказать', 'Order'))}
          </div>
        </div>`;
      })
      .join('')}
    ${orderBox(ctx, v)}`;
}

function workshopCars(ctx: Ctx): string {
  return ctx.game!.state.vehicles
    .filter((v) => v.location !== 'offsite')
    .map((v) => btn('select-car', [v.id], carLabel(v, ctx.lang)))
    .join(' ');
}

function orderBox(ctx: Ctx, v: VehicleInstance): string {
  if (!ctx.session.selectedSlot) return '';
  const lang = ctx.lang;
  const quotes = quotesForSlot(ctx.game!.state, v, ctx.session.selectedSlot).filter((q) => Q.includes(q.quality));
  if (!quotes.length) return '';
  return `<div class="card"><b>${e(say(lang, 'Заказ на этот узел', 'Order for this slot'))}</b>
    ${quotes
      .map(
        (q) =>
          `<div class="spread small"><span>${e(q.quality)} · ${e(q.manufacturer)}</span><span>${money(q.price, lang)} · ${q.deliveryHours}h</span></div>
           <div class="row">${btn('orderPart', [v.id, ctx.session.selectedSlot, q.quality, false], say(lang, 'Обычная', 'Standard'))}${btn('orderPart', [v.id, ctx.session.selectedSlot, q.quality, true], say(lang, 'Срочно', 'Rush'), 'btn primary')}</div>`,
      )
      .join('')}</div>`;
}

function diagPanel(ctx: Ctx): string {
  const v = selected(ctx);
  const lang = ctx.lang;
  if (!v) return `<p class="muted">${e(say(lang, 'Сначала выберите машину.', 'Select a car first.'))}</p>`;
  const a = ctx.game!.analysis(v.id);
  if (!a) return '';
  const kinds = ['visual', 'listen', 'scan', 'meter', 'compression', 'idle'];
  return `<div class="row">${kinds.map((k) => btn('requestDiag', [v.id, k], k)).join('')}</div>
    <div class="card"><b>${e(say(lang, 'Пуск', 'Start'))}</b>
      <div class="small">${a.start.fires ? e(say(lang, 'Схватывает', 'It catches')) : e(say(lang, 'Не схватывает', 'It does not catch'))} · ${e(say(lang, 'крутит', 'cranks'))}: ${a.start.cranks ? 'yes' : 'no'}</div>
      ${a.start.reasons.map((r) => `<div class="small warn">${e(tr(r, lang))}</div>`).join('')}
      ${btn('tryStart', [v.id], say(lang, 'Повернуть ключ', 'Turn the key'), 'btn primary')}
    </div>
    <div class="card"><b>${e(say(lang, 'Журнал', 'Notes'))}</b>
      ${v.clues.slice(-8).reverse().map((c) => `<div class="small">${e(c.source)} · ${e(tr(c.text, lang))}</div>`).join('') || `<div class="small muted">${e(say(lang, 'Пока тихо.', 'Quiet so far.'))}</div>`}
    </div>
    ${v.scanned ? `<div class="card">${Object.entries(a.systems).map(([k, n]) => `<div class="spread small"><span>${e(k)}</span><span>${Math.round(n * 100)}</span></div><div class="bar ${n < 0.45 ? 'bad' : 'good'}"><i style="width:${Math.round(n * 100)}%"></i></div>`).join('')}</div>` : `<p class="small muted">${e(say(lang, 'Системы без сканера не раскрываются цифрой. Слушайте, меряйте, смотрите.', 'Systems stay unnumbered until a scan. Listen, measure, look.'))}</p>`}
    ${a.codes.length && v.scanned ? `<div class="card">${a.codes.map((c) => `<div class="small">${e(c.id)} · ${e(tr(c.text, lang))}</div>`).join('')}</div>` : ''}`;
}

function partsPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const stock = s.garage.inventory
    .map((id) => s.parts[id])
    .filter(Boolean)
    .slice(0, 24);
  return `<div class="row">${btn('wait-delivery', [], say(lang, 'Ждать поставку', 'Wait for delivery'), 'btn primary')}</div>
    <h3>${e(say(lang, 'Витрина', 'Counter'))}</h3>
    ${s.market.featured
      .map(
        (o) =>
          `<div class="card"><div class="spread"><b>${e(tr(o.name, lang))}</b><span>${money(o.price, lang)}</span></div>
          <div class="small muted">${e(o.quality)} · ${o.condition}% · ${o.deliveryHours}h</div>
          <div class="row">${btn('buyFeatured', [o.id, false], say(lang, 'Купить', 'Buy'))}${btn('buyFeatured', [o.id, true], say(lang, 'Срочно', 'Rush'))}</div></div>`,
      )
      .join('')}
    <h3>${e(say(lang, 'Склад', 'Stock'))}</h3>
    ${stock
      .map(
        (p) =>
          `<div class="spread small"><span>${e(tr(p.name, lang))} · ${Math.round(p.condition)}%</span>${btn('scrapPart', [p.uid], say(lang, 'В лом', 'Scrap'), 'btn danger')}</div>`,
      )
      .join('') || `<p class="muted">${e(say(lang, 'Склад пуст.', 'The shelf is empty.'))}</p>`}
    ${s.garage.deliveries.map((d) => `<div class="small warn">${e(tr(d.offer.name, lang))} · ${Math.max(0, Math.round(d.eta - s.clock.absolute))} ${e(say(lang, 'мин', 'min'))}</div>`).join('')}`;
}

function marketPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const owned = s.vehicles.filter((v) => v.role === 'owned');
  const listings = [...s.market.listings, ...s.market.junk];
  return `<div class="small muted">${e(say(lang, 'Индекс рынка', 'Market index'))} ${s.market.index.toFixed(2)} · ${e(s.market.season)} · ${e(say(lang, 'топливо', 'fuel'))} ${money(s.market.fuelPrice, lang)}</div>
    <h3>${e(say(lang, 'Продать свою', 'Sell yours'))}</h3>
    ${owned
      .map((v) => {
        const ap = ctx.game!.appraisal(v.id);
        return `<div class="card"><b>${e(carLabel(v, lang))}</b><div class="small">${e(say(lang, 'оценка', 'value'))} ${money(ap?.market ?? 0, lang)}${v.trueOdometer > v.odometer * 1.3 ? ' · ' + e(say(lang, 'пробег подозрителен', 'odometer looks wrong')) : ''}</div>
          <div class="row">${btn('sellToDealer', [v.id], say(lang, 'Дилеру', 'To dealer'), 'btn primary')}${btn('listCar', [v.id, Math.round((ap?.market ?? 1000) * 1.05)], say(lang, 'В частные', 'Private list'))}</div></div>`;
      })
      .join('')}
    <h3>${e(say(lang, 'Чужие объявления', 'Other cars'))}</h3>
    ${listings
      .map((l) => {
        const v = s.vehicles.find((c) => c.id === l.vehicleId);
        if (!v) return '';
        const m = modelById(v.modelId);
        return `<div class="card"><div class="spread"><b>${e(m.brand)} ${e(m.model)}</b><span>${money(l.asking, lang)}</span></div>
          <div class="small muted">${e(l.seller)} · ${v.year} · ${e(tr(l.note, lang))}</div>
          ${l.inspected && l.systemPeek ? `<div class="small">${Object.entries(l.systemPeek).map(([k, n]) => `${e(k)} ${Math.round(Number(n) * 100)}`).join(' · ')}</div>` : ''}
          <div class="row">${btn('inspectListing', [l.id], say(lang, 'Осмотр за деньги', 'Paid look'))}${btn('buyListing', [l.id], say(lang, 'Купить', 'Buy'), 'btn primary')}</div></div>`;
      })
      .join('')}`;
}

function auctionPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const live = s.market.auctions.filter((a) => !a.resolved);
  if (!live.length) return `<p class="muted">${e(say(lang, 'Аукцион ещё не открыт. Время идёт — лоты появятся.', 'The auction is not open yet. Let time pass.'))}</p>${btn('advance-day', [], say(lang, 'Прожить день', 'Live a day'))}`;
  return live
    .map((a) => {
      const left = Math.max(0, Math.round(a.endsAt - s.clock.absolute));
      return `<div class="card"><b>${e(tr(a.title, lang))}</b><div class="small muted">${left} ${e(say(lang, 'мин', 'min'))}</div>
        ${a.lots
          .map((lot) => {
            const v = s.vehicles.find((c) => c.id === lot.vehicleId);
            const name = v ? carLabel(v, lang) : lot.id;
            return `<div class="spread"><span>${e(name)}</span><b>${money(lot.currentBid, lang)}</b></div>
              <div class="small muted">${e(lot.leader)}</div>
              <div class="row">${btn('inspectLot', [lot.id], say(lang, 'Смотреть', 'Look'))}${btn('placeBid', [lot.id, lot.currentBid + 250], '+250', 'btn primary')}${btn('placeBid', [lot.id, lot.currentBid + 800], '+800')}</div>`;
          })
          .join('')}</div>`;
    })
    .join('');
}

function ordersPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const orders = s.orders.filter((o) => o.status === 'offered' || o.status === 'active');
  if (!orders.length) return `<p class="muted">${e(say(lang, 'У ворот пусто. Подождите или прокрутите время.', 'Nobody at the door. Wait, or run the clock.'))}</p>${btn('advance-hours', [3], say(lang, 'Три часа', 'Three hours'))}`;
  return orders
    .map((o) => {
      const v = s.vehicles.find((c) => c.id === o.vehicleId);
      const grade = o.status === 'active' && v ? gradeOrder(s, o, v) : null;
      return `<div class="card"><div class="spread"><b>${e(tr(o.title, lang))}</b><span>${money(o.payoutBase, lang)}</span></div>
        <div class="small">${e(o.customer)} · ${e(o.personality)} · ${e(say(lang, 'до', 'due'))} ${clockParts(o.deadline).label}</div>
        <p class="small">${e(tr(o.brief, lang))}</p>
        <p class="small muted">«${e(tr(o.say, lang))}»</p>
        ${grade ? grade.lines.map((l) => `<div class="small ${l.ok ? 'good' : 'bad'}">${l.ok ? '●' : '○'} ${e(tr(l.text, lang))}</div>`).join('') + `<div class="small">${grade.met}/${grade.total}</div>` : ''}
        <div class="row">${o.status === 'offered' ? btn('acceptJob', [o.id], say(lang, 'Взять', 'Take'), 'btn primary') + btn('declineJob', [o.id], say(lang, 'Отказать', 'Decline')) : btn('deliverJob', [o.id], say(lang, 'Сдать', 'Deliver'), 'btn primary') + btn('setInvoice', [o.id, o.payoutBase], say(lang, 'Счёт по базе', 'Invoice the base')) + (v ? moveButtons(s, v, lang) : '')}</div>
      </div>`;
    })
    .join('');
}

function staffPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const v = selected(ctx);
  return `<div class="row">${btn('searchStaff', [], say(lang, 'Дать объявление', 'Post an ad'), 'btn primary')}</div>
    <h3>${e(say(lang, 'В штате', 'On the floor'))}</h3>
    ${s.employees
      .map(
        (emp) => `<div class="card"><div class="spread"><b>${e(emp.name)}</b><span>${money(emp.wage, lang)}</span></div>
        <div class="small muted">${e(emp.role)} · ${e(say(lang, 'ур.', 'lv'))} ${emp.level} · ${e(say(lang, 'дух', 'morale'))} ${Math.round(emp.morale)}</div>
        ${emp.task ? `<div class="small">${e(tr(emp.task.label, lang))}</div>` : ''}
        <div class="row">${btn('setOvertime', [emp.id, !emp.overtime], emp.overtime ? say(lang, 'Без сверхурочных', 'No overtime') : say(lang, 'Сверхурочные', 'Overtime'))}${btn('train', [emp.id], say(lang, 'Учить', 'Train'))}${v ? btn('assignWork', [emp.id, 'inspect', v.id, ctx.session.selectedSlot ?? 'hood'], say(lang, 'Осмотр', 'Inspect')) : ''}${v ? btn('assignWork', [emp.id, 'repair', v.id, ctx.session.selectedSlot ?? 'hood'], say(lang, 'Ремонт', 'Repair')) : ''}${btn('fire', [emp.id], say(lang, 'Уволить', 'Fire'), 'btn danger')}</div></div>`,
      )
      .join('') || `<p class="muted">${e(say(lang, 'Вы один.', 'You are alone.'))}</p>`}
    <h3>${e(say(lang, 'У ворот', 'At the gate'))}</h3>
    ${s.candidates
      .map(
        (c) => `<div class="card"><div class="spread"><b>${e(c.name)}</b><span>${money(c.wage, lang)}</span></div>
        <div class="small">${e(c.role)} · ${e(say(lang, 'качество', 'quality'))} ${Math.round(c.quality * 100)}</div>
        ${btn('hire', [c.id], say(lang, 'Нанять', 'Hire'), 'btn primary')}</div>`,
      )
      .join('')}`;
}

function financePanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const eco = s.economy;
  return `<div class="card"><div class="spread"><span>${e(say(lang, 'Касса', 'Cash'))}</span><b>${money(eco.cash, lang)}</b></div>
    <div class="spread"><span>${e(say(lang, 'Долг', 'Debt'))}</span><span>${money(eco.debt, lang)}</span></div>
    <div class="spread"><span>${e(say(lang, 'Лимит', 'Limit'))}</span><span>${money(creditLimit(s), lang)}</span></div>
    <div class="spread"><span>${e(say(lang, 'Налог', 'Tax'))}</span><span>${money(eco.taxDue, lang)}</span></div>
    <div class="spread"><span>${e(say(lang, 'Аренда / нед.', 'Rent / week'))}</span><span>${money(eco.weeklyRent, lang)}</span></div>
    <div class="spread"><span>${e(say(lang, 'Стоимость имени', 'Net worth'))}</span><b>${money(ctx.game!.netWorth(), lang)}</b></div>
    <div class="row">${btn('borrow', [2000], say(lang, 'Занять 2 000', 'Borrow 2,000'))}${btn('repay', [2000], say(lang, 'Отдать 2 000', 'Repay 2,000'))}</div>
  </div>
  <h3>${e(say(lang, 'Книга', 'Ledger'))}</h3>
  ${eco.ledger
    .slice(0, 12)
    .map((row) => `<div class="spread small"><span>${e(tr(row.text, lang))}</span><span class="${row.amount < 0 ? 'bad' : 'good'}">${money(row.amount, lang)}</span></div>`)
    .join('')}`;
}

function cityPanel(ctx: Ctx): string {
  const lang = ctx.lang;
  return POIS.map((p) => {
    const mins = travelMinutes('garage', p.id);
    return `<div class="card"><div class="spread"><b>${e(tr(p.name, lang))}</b><span class="small">${mins} ${e(say(lang, 'мин', 'min'))}</span></div>
      <div class="row">${btn('travel', [p.id], say(lang, 'Доехать по времени', 'Travel by clock'))}${btn('start-drive', ['city', p.id], say(lang, 'Сесть за руль', 'Drive there'), 'btn primary')}</div></div>`;
  }).join('');
}

function progressPanel(ctx: Ctx): string {
  const s = ctx.game!.state;
  const lang = ctx.lang;
  const title = ctx.game!.reputationTitle();
  return `<div class="card"><b>${e(tr(title, lang))}</b><div class="small">${e(say(lang, 'репутация', 'reputation'))} ${Math.round(s.reputation)}</div>
    <div class="small muted">${e(s.meta.company)} · ${e(s.meta.boss)} · ${e(s.meta.difficulty)}</div></div>
    ${ctx.game!.objectives().map((o) => `<p class="objective">${e(tr(o, lang))}</p>`).join('')}
    <div class="small">${e(say(lang, 'Заказы', 'Jobs'))} ${s.stats.ordersCompleted} · ${e(say(lang, 'продажи', 'sales'))} ${s.stats.carsSold} · ${e(say(lang, 'км', 'km'))} ${Math.round(s.stats.distanceKm)}</div>
    ${s.stats.bestZeroTo100 != null ? `<div class="small">0–100 ${s.stats.bestZeroTo100.toFixed(1)} s</div>` : ''}
    <h3>${e(say(lang, 'Вехи', 'Marks'))}</h3>
    ${s.milestones.map((m) => `<div class="small">${e(tr(m.title, lang))}</div>`).join('') || `<p class="muted">${e(say(lang, 'Пока без вех.', 'No marks yet.'))}</p>`}
    <h3>${e(say(lang, 'Отзывы', 'Reviews'))}</h3>
    ${s.reviews.slice(0, 5).map((r) => `<div class="small">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)} ${e(r.customer)} — ${e(tr(r.text, lang))}</div>`).join('')}`;
}

function tunePanel(ctx: Ctx): string {
  const v = selected(ctx);
  const lang = ctx.lang;
  if (!v) return `<p class="muted">${e(say(lang, 'Нечего настраивать.', 'Nothing to set up.'))}</p>`;
  return `<div class="card"><b>${e(carLabel(v, lang))}</b>
    <div class="small">ECU ${v.tune.ecuPower.toFixed(2)} · ride ${v.tune.ride.toFixed(2)} · aero ${v.tune.aero.toFixed(2)}</div>
    <div class="row">${btn('tuneEcu', [v.id, 0.08], 'ECU +')}${btn('tuneEcu', [v.id, -0.04], 'ECU −')}${btn('tuneRide', [v.id, -0.04], say(lang, 'Ниже', 'Lower'))}${btn('tuneRide', [v.id, 0.04], say(lang, 'Выше', 'Raise'))}${btn('tuneAero', [v.id, 0.2], say(lang, 'Прижим', 'Aero'))}</div>
    <div class="row">${btn('requestDyno', [v.id], say(lang, 'Стенд', 'Dyno'), 'btn primary')}${btn('requestAlign', [v.id], say(lang, 'Сход-развал', 'Align'))}${btn('saveSetup', [v.id, 'bay'], say(lang, 'Запомнить', 'Save setup'))}</div>
    ${v.dyno ? `<div class="small">${Math.round(v.dyno.peakPower)} hp · ${Math.round(v.dyno.peakTorque)} Nm</div>` : ''}
  </div>`;
}

function saveButtons(ctx: Ctx): string {
  const lang = ctx.lang;
  return `<div class="row">${[1, 2, 3, 4, 5].map((n) => btn('save-slot', [n], say(lang, 'Писать в', 'Save') + ' ' + n, 'btn primary')).join('')}</div>`;
}

export function hudBits(state: GameState, lang: Lang): { company: string; cash: string; clock: string; rep: string; weather: string } {
  const c = clockParts(state.clock.absolute);
  return {
    company: state.meta.company,
    cash: formatMoney(state.economy.cash, lang),
    clock: `${say(lang, 'день', 'day')} ${c.day} · ${c.label}`,
    rep: String(Math.round(state.reputation)),
    weather: state.weather.kind,
  };
}

export function eventHtml(ctx: Ctx): string {
  const ev = ctx.game?.state.events.find((e) => !e.resolved);
  if (!ev) return '';
  const lang = ctx.lang;
  return `<div class="modal"><div class="sheet"><h3>${e(tr(ev.title, lang))}</h3><p>${e(tr(ev.text, lang))}</p>
    <div class="row">${(ev.choices ?? [{ id: 'ok', label: { ru: 'Понял', en: 'Understood' } }]).map((c) => btn('resolveEvent', [ev.id, c.id], e(tr(c.label, lang)), 'btn primary')).join('')}</div></div></div>`;
}

export const DOCK: [string, string, string][] = [
  ['workshop', 'Бокс', 'Bay'],
  ['car', 'Машина', 'Car'],
  ['diag', 'Диагностика', 'Diag'],
  ['parts', 'Запчасти', 'Parts'],
  ['orders', 'Заказы', 'Jobs'],
  ['market', 'Рынок', 'Market'],
  ['auction', 'Аукцион', 'Auction'],
  ['staff', 'Штат', 'Staff'],
  ['finance', 'Касса', 'Books'],
  ['city', 'Город', 'City'],
  ['tune', 'Настройка', 'Setup'],
  ['progress', 'Имя', 'Name'],
  ['saves', 'Сохранения', 'Saves'],
  ['settings', 'Настройки', 'Settings'],
];
