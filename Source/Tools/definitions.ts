import content from '../../Assets/data/content.json';
import type { ToolDef, UpgradeDef } from '../Core/types';

export const TOOLS = content.tools as ToolDef[];
export const UPGRADES = content.upgrades as UpgradeDef[];

export function toolById(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function upgradeById(id: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

export function ownedCapabilities(tools: string[], upgrades: string[]): Set<string> {
  const caps = new Set<string>();
  for (const id of tools) {
    const t = toolById(id);
    if (t) caps.add(t.grants);
    caps.add(id);
  }
  for (const id of upgrades) {
    const u = upgradeById(id);
    if (!u) continue;
    caps.add(id);
    for (const g of u.grants ?? []) caps.add(g);
  }
  if (upgrades.includes('lift')) caps.add('lift');
  if (upgrades.includes('engineShop') || upgrades.includes('lift')) caps.add('hoist');
  return caps;
}

export function hasCapability(tools: string[], upgrades: string[], cap: string): boolean {
  return ownedCapabilities(tools, upgrades).has(cap);
}

export function bayCount(upgrades: string[]): number {
  let n = 1;
  for (const id of upgrades) {
    const u = upgradeById(id);
    if (u?.bays) n += u.bays;
  }
  return Math.min(4, n);
}

export function parkingCount(upgrades: string[]): number {
  let n = 3;
  if (upgrades.includes('warehouse')) n += 2;
  if (upgrades.includes('showroom')) n += 2;
  if (upgrades.includes('bay3')) n += 1;
  return n;
}

export function staffCap(upgrades: string[]): number {
  if (upgrades.includes('showroom')) return 8;
  if (upgrades.includes('office')) return 4;
  return 1;
}

export function weeklyUpkeep(upgrades: string[]): number {
  return upgrades.reduce((s, id) => s + (upgradeById(id)?.upkeep ?? 0), 0);
}
