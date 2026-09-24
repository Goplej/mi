import type { ConditionState, L10n, Lang } from './types';

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function round(n: number, d = 0): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

export function money(n: number): number {
  return Math.round(n);
}

export function conditionState(n: number): ConditionState {
  if (n >= 92) return 'new';
  if (n >= 75) return 'good';
  if (n >= 50) return 'worn';
  if (n >= 30) return 'damaged';
  if (n >= 12) return 'critical';
  return 'failed';
}

export function conditionLabel(state: ConditionState, lang: Lang): string {
  const map: Record<ConditionState, L10n> = {
    new: { ru: 'Новая', en: 'New' },
    good: { ru: 'Хорошая', en: 'Good' },
    worn: { ru: 'Изношенная', en: 'Worn' },
    damaged: { ru: 'Повреждённая', en: 'Damaged' },
    critical: { ru: 'Критическая', en: 'Critical' },
    failed: { ru: 'Неисправная', en: 'Failed' },
  };
  return map[state][lang];
}

export function tr(text: L10n | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] || text.ru || text.en || '';
}

export function l10n(ru: string, en: string): L10n {
  return { ru, en };
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatMoney(n: number, lang: Lang): string {
  const v = Math.round(n);
  const body = Math.abs(v).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
  return (v < 0 ? '−' : '') + body + ' ¤';
}

export function formatNum(n: number, digits = 0, lang: Lang = 'ru'): string {
  return n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function clockParts(absolute: number): { day: number; hour: number; minute: number; label: string } {
  const day = Math.floor(absolute / 1440) + 1;
  const minuteOfDay = absolute % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { day, hour, minute, label };
}

export function seasonOf(day: number): 'winter' | 'spring' | 'summer' | 'autumn' {
  const d = ((day - 1) % 360 + 360) % 360;
  if (d < 90) return 'winter';
  if (d < 180) return 'spring';
  if (d < 270) return 'summer';
  return 'autumn';
}

export function uid(state: { seq: number }, prefix: string): string {
  state.seq += 1;
  return `${prefix}_${state.seq.toString(36)}`;
}

export function vinFor(brand: string, year: number, seq: number): string {
  const b = brand.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const tail = (seq * 17 + year).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return `GE${b}${String(year).slice(-2)}${tail}`;
}

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function minOf(nums: number[], fallback = 100): number {
  if (!nums.length) return fallback;
  return Math.min(...nums);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function replaceVars(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
