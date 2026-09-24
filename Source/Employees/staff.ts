import content from '../../Assets/data/content.json';
import type { Employee, GameState, Role } from '../Core/types';
import { RNG } from '../Core/rng';
import { staffCap } from '../Tools/definitions';
import { uid } from '../Core/util';

const NAMES = content.names.employees as string[];
const ROLES: Role[] = ['mechanic', 'diagnostician', 'bodyworker', 'electrician', 'painter', 'manager', 'salesperson', 'administrator'];

export function wageFor(role: Role, level: number, quality: number): number {
  const base: Record<Role, number> = {
    mechanic: 420,
    diagnostician: 480,
    bodyworker: 450,
    electrician: 470,
    painter: 440,
    manager: 560,
    salesperson: 500,
    administrator: 390,
  };
  return Math.round(base[role] * (0.8 + level * 0.12) * (0.85 + quality * 0.2));
}

export function makeCandidate(state: GameState, rng: RNG, role?: Role): Employee {
  const picked = role ?? rng.pick(ROLES);
  const level = rng.int(1, state.reputation > 400 ? 4 : 2);
  const quality = rng.float(0.7, 1.15);
  const speed = rng.float(0.75, 1.2);
  return {
    id: uid(state, 'emp'),
    name: rng.pick(NAMES),
    role: picked,
    level,
    xp: 0,
    speed,
    quality,
    wage: wageFor(picked, level, quality),
    morale: rng.int(62, 88),
    assignedBay: null,
    overtime: false,
    task: null,
    jobsDone: 0,
  };
}

export function refreshCandidates(state: GameState, rng: RNG): void {
  const n = 3 + (state.garage.upgrades.includes('office') ? 2 : 0);
  state.candidates = [];
  for (let i = 0; i < n; i++) state.candidates.push(makeCandidate(state, rng));
}

export function hireLimit(state: GameState): number {
  return staffCap(state.garage.upgrades);
}

export function payroll(state: GameState): number {
  return state.employees.reduce((s, e) => s + e.wage, 0);
}

export function gainXp(emp: Employee, amount: number): void {
  emp.xp += amount;
  const need = emp.level * 40;
  if (emp.xp >= need && emp.level < 10) {
    emp.level += 1;
    emp.xp = 0;
    emp.speed = Math.min(1.7, emp.speed + 0.04);
    emp.quality = Math.min(1.45, emp.quality + 0.04);
    emp.wage = wageFor(emp.role, emp.level, emp.quality);
  }
}
