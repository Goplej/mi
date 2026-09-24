/** Deterministic mulberry32-style RNG. Seed is stored in the save. */
export class RNG {
  constructor(public seed: number) {
    if (!Number.isFinite(seed) || seed === 0) this.seed = 0x1a2b3c4d;
  }

  next(): number {
    this.seed |= 0;
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(items: { item: T; w: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.w), 0);
    let r = this.next() * (total || 1);
    for (const i of items) {
      r -= Math.max(0, i.w);
      if (r <= 0) return i.item;
    }
    return items[items.length - 1].item;
  }

  fork(salt: number): RNG {
    return new RNG((Math.imul(this.seed ^ salt, 0x9e3779b1) ^ salt) || 1);
  }
}

export function hashSeed(n: number, salt: number): number {
  let x = Math.imul(n ^ salt, 0x9e3779b1);
  x ^= x >>> 16;
  return x || 1;
}
