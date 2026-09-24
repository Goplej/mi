import type { Game } from '../Game/game';
import type { Lang } from '../Core/types';
import { tr } from '../Core/util';
import { POIS } from '../World/city';
import { DOCK, eventHtml, hudBits, menuHtml, panelHtml, say } from './panels';
import type { Session } from './session';

export class Shell {
  readonly overlay: HTMLElement;
  private toastUntil = 0;

  constructor(
    root: HTMLElement,
    private get: () => { game: Game | null; session: Session; lang: Lang },
    private onCmd: (cmd: string, args: unknown[]) => void,
  ) {
    root.innerHTML = '<canvas id="view"></canvas><div id="overlay"></div>';
    this.overlay = root.querySelector('#overlay')!;
    this.overlay.addEventListener('click', (ev) => {
      const el = (ev.target as HTMLElement).closest('[data-cmd]') as HTMLElement | null;
      if (!el || el.hasAttribute('disabled')) return;
      ev.preventDefault();
      const args = el.dataset.a ? (JSON.parse(el.dataset.a) as unknown[]) : [];
      this.onCmd(el.dataset.cmd || '', args);
    });
    this.overlay.addEventListener('change', (ev) => this.onSetting(ev.target as HTMLElement));
    this.overlay.addEventListener('input', (ev) => {
      const el = ev.target as HTMLInputElement;
      if (el.dataset.set && el.type === 'range') this.onCmd('setting', [el.dataset.set, Number(el.value)]);
    });
  }

  canvas(): HTMLCanvasElement {
    return document.querySelector('#view') as HTMLCanvasElement;
  }

  render(): void {
    const bag = this.get();
    const { game, session, lang } = bag;
    if (session.mode === 'menu') {
      this.overlay.innerHTML = menuHtml(bag) + (session.toast ? `<div class="toast ${session.toastKind}" id="toast">${esc(session.toast)}</div>` : '');
      return;
    }
    if (!game) return;
    const hud = hudBits(game.state, lang);
    const driving = session.mode === 'city' || session.mode === 'track';
    const work = game.state.work.active;
    this.overlay.innerHTML = `
      <header class="hud">
        <div class="brand-mini">GARAGE EMPIRE</div>
        <div class="hud-stat"><b>${esc(hud.company)}</b><span>${esc(say(lang, 'мастерская', 'shop'))}</span></div>
        <div class="hud-stat"><b id="cash">${esc(hud.cash)}</b><span>${esc(say(lang, 'касса', 'cash'))}</span></div>
        <div class="hud-stat"><b id="clock">${esc(hud.clock)}</b><span id="wx">${esc(hud.weather)}</span></div>
        <div class="hud-stat"><b id="rep">${esc(hud.rep)}</b><span>${esc(say(lang, 'имя', 'name'))}</span></div>
        <div class="hud-spacer"></div>
        <div class="speeds">
          <button type="button" data-cmd="speed" data-a="[0]" class="${game.state.clock.paused ? 'on' : ''}">II</button>
          <button type="button" data-cmd="speed" data-a="[1]" class="${!game.state.clock.paused && game.state.clock.speed === 1 ? 'on' : ''}">1×</button>
          <button type="button" data-cmd="speed" data-a="[4]">4×</button>
          <button type="button" data-cmd="speed" data-a="[12]">12×</button>
          <button type="button" data-cmd="wait-morning" data-a="[]">${esc(say(lang, 'Утро', 'Dawn'))}</button>
          <button type="button" data-cmd="pause-menu" data-a="[]">Esc</button>
        </div>
      </header>
      ${driving ? '' : `<nav class="dock">${DOCK.map(([id, ru, en]) => `<button type="button" data-cmd="open-panel" data-a="${esc(JSON.stringify([id]))}" class="${session.panel === id ? 'on' : ''}">${esc(say(lang, ru, en))}</button>`).join('')}</nav>`}
      ${driving ? '' : panelHtml(bag)}
      ${driving ? driveHtml(session, lang) : ''}
      ${work && !driving ? `<div class="work"><div class="spread"><b id="work-label">${esc(tr(work.label, lang))}</b><span id="work-left">${Math.ceil(work.remaining)} ${esc(say(lang, 'мин', 'min'))}</span></div><div class="bar"><i id="work-bar" style="width:${pct(work)}%"></i></div></div>` : ''}
      ${session.toast ? `<div class="toast ${session.toastKind}" id="toast">${esc(session.toast)}</div>` : ''}
      ${eventHtml(bag)}
      ${session.pausedMenu ? pauseHtml(lang) : ''}
      ${game.state.meta.bankrupt ? `<div class="modal"><div class="sheet"><h3>${esc(say(lang, 'Мастерская закрыта', 'The shop is closed'))}</h3><p>${esc(say(lang, 'Касса не выдержала. Загрузите слот или начните заново.', 'The books did not survive. Load a slot or start again.'))}</p><div class="row"><button type="button" class="btn primary" data-cmd="to-menu" data-a="[]">${esc(say(lang, 'В меню', 'Main menu'))}</button></div></div></div>` : ''}
    `;
    this.toastUntil = performance.now() + 4200;
  }

  tick(): void {
    const { game, session, lang } = this.get();
    if (!game || session.mode === 'menu') return;
    const hud = hudBits(game.state, lang);
    setText('#cash', hud.cash);
    setText('#clock', hud.clock);
    setText('#rep', hud.rep);
    setText('#wx', hud.weather);
    const work = game.state.work.active;
    if (work) {
      setText('#work-left', `${Math.ceil(work.remaining)} ${say(lang, 'мин', 'min')}`);
      const bar = document.getElementById('work-bar');
      if (bar) bar.style.width = pct(work) + '%';
    }
    const d = session.drive;
    if (d) {
      const kmh = Math.abs(d.body.speed) * 3.6;
      setText('#speed', String(Math.round(kmh)));
      setText('#gear', d.pt.electric ? 'E' : String(d.body.gear));
      setText('#rpm', String(Math.round(d.body.rpm)));
      setText('#temp', d.body.temp.toFixed(0) + '°');
      setText('#fuel', Math.round(d.body.fuel * 100) + '%');
      setText('#lat', d.body.lateral.toFixed(2) + ' g');
      setText('#surf', d.surface);
      setText('#zero', d.zero ? d.zero.toFixed(1) + ' s' : '—');
      const canvas = document.getElementById('minimap') as HTMLCanvasElement | null;
      if (canvas) drawMap(canvas, d.body.x, d.body.y, d.place);
    }
    const toast = document.getElementById('toast');
    if (toast && performance.now() > this.toastUntil) toast.remove();
  }

  private onSetting(el: HTMLElement): void {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
    const key = el.dataset.set;
    if (!key) return;
    const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
    this.onCmd('setting', [key, value]);
  }
}

function pct(work: { remaining: number; total: number }): number {
  return Math.max(0, Math.min(100, Math.round((1 - work.remaining / Math.max(1, work.total)) * 100)));
}

function setText(sel: string, text: string): void {
  const el = document.querySelector(sel);
  if (el && el.textContent !== text) el.textContent = text;
}

function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function driveHtml(session: Session, lang: Lang): string {
  const poi = session.interact ? POIS.find((p) => p.id === session.interact) : null;
  return `<div class="drive">
      <div><div class="speedo"><span id="speed">0</span><small>km/h</small></div><div class="small muted" id="gear">1</div></div>
      <div class="small">
        <div>rpm <b id="rpm">0</b></div>
        <div>${esc(say(lang, 'темп.', 'temp'))} <b id="temp">0°</b></div>
        <div>${esc(say(lang, 'бак', 'fuel'))} <b id="fuel">0%</b></div>
        <div><b id="lat">0 g</b> · <span id="surf">asphalt</span></div>
        <div>0–100 <b id="zero">—</b></div>
      </div>
      <div class="row"><button type="button" class="btn" data-cmd="exit-drive" data-a="[]">${esc(say(lang, 'Выйти', 'Leave'))}</button><button type="button" class="btn" data-cmd="toggle-lights" data-a="[]">${esc(say(lang, 'Свет', 'Lights'))}</button></div>
    </div>
    <div class="map"><canvas id="minimap" width="180" height="180"></canvas></div>
    ${poi ? `<div class="prompt">${esc(say(lang, 'E — войти:', 'E — enter:'))} ${esc(tr(poi.name, lang))}</div>` : `<div class="prompt pass">${esc(say(lang, 'WASD — ехать. Пробел — ручник. F — свет.', 'WASD to drive. Space is the handbrake. F is the lights.'))}</div>`}`;
}

function pauseHtml(lang: Lang): string {
  const items: [string, string, string][] = [
    ['resume', 'Continue', say(lang, 'Вернуться в бокс', 'Back to the bay')],
    ['save-slot', 'Save', say(lang, 'Слот 1', 'Slot 1')],
    ['open-saves', 'Load Game', say(lang, 'Другие слоты', 'Other slots')],
    ['open-settings', 'Settings', say(lang, 'Звук и язык', 'Sound and language')],
    ['to-menu', 'Main menu', say(lang, 'К воротам', 'To the door')],
    ['exit', 'Exit', say(lang, 'Закрыть смену', 'Close the shift')],
  ];
  return `<div class="modal"><div class="sheet"><p class="eyebrow">GARAGE EMPIRE</p><h3>${esc(say(lang, 'Пауза', 'Paused'))}</h3>
    <div class="menu-list">${items
      .map(([cmd, en, sub]) => {
        const args = cmd === 'save-slot' ? [1] : [];
        const name = cmd === 'open-saves' || cmd === 'open-settings' ? 'pause-nav' : cmd;
        const payload = cmd === 'open-saves' ? ['saves'] : cmd === 'open-settings' ? ['settings'] : args;
        return `<button type="button" class="menu-btn" data-cmd="${name}" data-a="${esc(JSON.stringify(payload))}"><span class="menu-en">${en}</span><span class="menu-sub">${esc(sub)}</span></button>`;
      })
      .join('')}</div></div></div>`;
}

function drawMap(canvas: HTMLCanvasElement, x: number, z: number, place: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, 180, 180);
  ctx.fillStyle = '#10150f';
  ctx.fillRect(0, 0, 180, 180);
  ctx.strokeStyle = '#3c4148';
  ctx.lineWidth = 6;
  if (place === 'city') {
    ctx.beginPath();
    ctx.moveTo(10, 90);
    ctx.lineTo(170, 90);
    ctx.moveTo(90, 10);
    ctx.lineTo(90, 170);
    ctx.stroke();
    for (const p of POIS) {
      const px = 90 + (p.x / 200) * 70;
      const py = 90 + (p.z / 200) * 70;
      ctx.fillStyle = p.id === 'garage' ? '#e3a008' : '#d7c7a5';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    ctx.fillStyle = '#f4efe6';
    ctx.beginPath();
    ctx.arc(90 + (x / 200) * 70, 90 + (z / 200) * 70, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#4a5158';
    ctx.strokeRect(78, 12, 24, 150);
    ctx.strokeRect(40, 110, 90, 36);
    ctx.fillStyle = '#6a5438';
    ctx.fillRect(128, 70, 12, 28);
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(86 + x * 0.7, 160 - z * 0.7, 4, 4);
  }
}
