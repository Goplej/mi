import type { GameState, Offer, PartSize, Quality, VehicleInstance } from '../Core/types';
import { RNG } from '../Core/rng';
import { hashString } from '../Core/util';
import { MANUFACTURERS, PART_TYPES, partType, qualityDef } from '../VehicleParts/catalog';
import { partDisplayName } from '../VehicleParts/build';
import { partPrice } from './pricing';
import { slotById } from '../Vehicles/assembly';
import { modelById } from '../Vehicles/models';

const QUALITY_ORDER: Quality[] = ['used', 'aftermarket', 'oem', 'performance', 'racing'];

export function deliveryHours(quality: Quality, state: GameState, rare = false): number {
  const q = qualityDef(quality);
  let h = q.delivery * state.market.deliveryMul;
  if (rare) h *= 2.4;
  if (state.garage.upgrades.includes('warehouse') && !rare) h *= 0.55;
  if (state.market.categoryMul && Object.values(state.market.categoryMul).some((n) => n > 1.4)) h *= 1.4;
  return Math.max(quality === 'used' ? 1 : 2, Math.round(h));
}

export function quote(
  state: GameState,
  type: string,
  size: PartSize,
  quality: Quality,
  brand: string | null,
  salt = '',
): Offer {
  const def = partType(type);
  const q = qualityDef(quality);
  const day = Math.floor(state.clock.absolute / 1440);
  const rng = new RNG(hashString(`${state.meta.seed}|${day}|${salt}|${type}|${size}|${quality}|${brand ?? ''}`) || 1);
  const oemBrand = quality === 'oem' ? brand : null;
  const manufacturer =
    quality === 'oem' && brand ? `${brand} OE` : rng.pick(MANUFACTURERS[quality]);
  const condition = quality === 'used' ? rng.int(q.cond[0], q.cond[1]) : 100;
  const rare = !!def.rare || quality === 'racing';
  const price = partPrice(def.basePrice, q.price, def.category, state, 1) * (rare ? 1.35 : 1) * (oemBrand ? 1.08 : 1);
  return {
    id: `q_${type}_${size}_${quality}_${oemBrand ?? 'u'}_${salt}`,
    defKey: `${type}|${size}|${quality}|${oemBrand ?? 'universal'}`,
    type,
    size,
    quality,
    brand: oemBrand,
    name: partDisplayName(type, quality, oemBrand, manufacturer),
    manufacturer,
    price: Math.round(price),
    deliveryHours: deliveryHours(quality, state, rare),
    condition,
    stock: quality === 'used' ? 1 : 4,
    featured: false,
    rare,
  };
}

export function quotesForSlot(state: GameState, vehicle: VehicleInstance, slotId: string): Offer[] {
  const model = modelById(vehicle.modelId);
  const spec = slotById(model, slotId);
  if (!spec) return [];
  const qualities = QUALITY_ORDER.filter((q) => q !== 'racing' || state.reputation >= 350 || state.garage.upgrades.includes('engineShop'));
  return qualities.map((q) => quote(state, spec.type, spec.size, q, model.brand, slotId));
}

export function longBlockQuote(state: GameState, size: PartSize, brand: string): Offer {
  return quote(state, 'longBlock', size, 'oem', brand, 'long');
}

export function refreshFeatured(state: GameState, rng: RNG): void {
  const offers: Offer[] = [];
  const types = [...PART_TYPES].filter((t) => !t.rare && t.id !== 'longBlock' && t.id !== 'batteryPack');
  for (let i = 0; i < 8; i++) {
    const def = rng.pick(types);
    const size = rng.pick(def.sizes);
    const quality = rng.weighted<Quality>([
      { item: 'used', w: 3 },
      { item: 'aftermarket', w: 4 },
      { item: 'oem', w: 2 },
      { item: 'performance', w: state.reputation > 200 ? 1 : 0.2 },
      { item: 'racing', w: state.reputation > 500 ? 0.4 : 0 },
    ]);
    const o = quote(state, def.id, size, quality, null, `feat${i}${state.clock.absolute}`);
    o.featured = true;
    o.price = Math.round(o.price * rng.float(0.72, 0.92));
    o.stock = quality === 'used' ? 1 : rng.int(1, 3);
    o.id = `feat_${state.clock.absolute}_${i}`;
    offers.push(o);
  }
  const rare = rng.pick(PART_TYPES.filter((t) => t.rare || t.id === 'turbo' || t.id === 'wing'));
  const rareOffer = quote(state, rare.id, rng.pick(rare.sizes), 'used', null, `rare${state.clock.absolute}`);
  rareOffer.featured = true;
  rareOffer.price = Math.round(rareOffer.price * 0.7);
  rareOffer.stock = 1;
  rareOffer.id = `feat_rare_${state.clock.absolute}`;
  offers.push(rareOffer);
  state.market.featured = offers;
}
