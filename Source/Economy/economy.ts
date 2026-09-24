import type { Difficulty, GameState, L10n } from '../Core/types';
import { money, uid } from '../Core/util';
import { weeklyUpkeep } from '../Tools/definitions';

export function taxRate(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 0.08;
  if (difficulty === 'hard') return 0.16;
  return 0.12;
}

export function rentOf(state: GameState): number {
  const base = state.meta.difficulty === 'easy' ? 140 : state.meta.difficulty === 'hard' ? 260 : 190;
  const admin = state.employees.some((e) => e.role === 'administrator') ? 0.9 : 1;
  return money(base * admin + weeklyUpkeep(state.garage.upgrades));
}

export function freeCash(state: GameState): number {
  const held = state.market.auctions
    .flatMap((a) => a.lots)
    .filter((l) => l.leader === 'player')
    .reduce((s, l) => s + l.hold, 0);
  return state.economy.cash - held;
}

export function creditLimit(state: GameState): number {
  const office = state.garage.upgrades.includes('office') ? 1.4 : 1;
  return money((4000 + state.reputation * 40) * office);
}

export function addLedger(state: GameState, amount: number, category: string, text: L10n): void {
  state.economy.ledger.unshift({
    at: state.clock.absolute,
    amount: money(amount),
    category,
    text,
  });
  state.economy.ledger = state.economy.ledger.slice(0, 240);
  if (amount >= 0) state.economy.lifetimeRevenue += amount;
  else state.economy.lifetimeExpenses += -amount;
}

export function charge(state: GameState, amount: number, category: string, text: L10n): boolean {
  const cost = money(amount);
  if (freeCash(state) < cost) return false;
  state.economy.cash = money(state.economy.cash - cost);
  addLedger(state, -cost, category, text);
  return true;
}

export function pay(state: GameState, amount: number, category: string, text: L10n): void {
  const gain = money(amount);
  state.economy.cash = money(state.economy.cash + gain);
  addLedger(state, gain, category, text);
}

export function notify(state: GameState, kind: 'info' | 'good' | 'bad' | 'warn', text: L10n): void {
  state.notifications.unshift({
    id: uid(state, 'note'),
    at: state.clock.absolute,
    kind,
    text,
    read: false,
  });
  state.notifications = state.notifications.slice(0, 60);
}

export function weeklyReport(state: GameState): { income: number; expense: number; byCat: Record<string, number> } {
  const from = state.clock.absolute - 7 * 1440;
  const byCat: Record<string, number> = {};
  let income = 0;
  let expense = 0;
  for (const e of state.economy.ledger) {
    if (e.at < from) continue;
    byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
    if (e.amount >= 0) income += e.amount;
    else expense += -e.amount;
  }
  return { income, expense, byCat };
}
