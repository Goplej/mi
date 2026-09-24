export interface Poi {
  id: string;
  name: { ru: string; en: string };
  x: number;
  z: number;
  kind: string;
  w: number;
  d: number;
}

export const CITY = {
  size: 420,
  roadHalf: 8,
};

export const POIS: Poi[] = [
  { id: 'garage', name: { ru: 'Ваш гараж', en: 'Your garage' }, x: -36, z: 28, kind: 'garage', w: 28, d: 18 },
  { id: 'dealer', name: { ru: 'Автосалон', en: 'Dealership' }, x: 78, z: 36, kind: 'dealer', w: 26, d: 16 },
  { id: 'market', name: { ru: 'Рынок автомобилей', en: 'Used market' }, x: -78, z: 40, kind: 'market', w: 24, d: 16 },
  { id: 'parts', name: { ru: 'Магазин запчастей', en: 'Parts store' }, x: 42, z: -58, kind: 'parts', w: 18, d: 14 },
  { id: 'fuel', name: { ru: 'Заправка', en: 'Fuel station' }, x: -48, z: -70, kind: 'fuel', w: 16, d: 12 },
  { id: 'wash', name: { ru: 'Автомойка', en: 'Car wash' }, x: 24, z: 86, kind: 'wash', w: 14, d: 12 },
  { id: 'junk', name: { ru: 'Свалка', en: 'Junkyard' }, x: -120, z: -36, kind: 'junk', w: 30, d: 22 },
  { id: 'track', name: { ru: 'Гоночная площадка', en: 'Race pad' }, x: 130, z: -90, kind: 'track', w: 40, d: 30 },
  { id: 'rival', name: { ru: 'Мастерская «Ключ»', en: 'Wrench rival shop' }, x: -96, z: 88, kind: 'rival', w: 18, d: 12 },
  { id: 'rival2', name: { ru: 'Сервис Helix', en: 'Helix service' }, x: 96, z: 96, kind: 'rival', w: 18, d: 12 },
];

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

export function cityBuildings(): Building[] {
  const out: Building[] = [];
  const blocks = [
    [-150, 70], [-70, 120], [40, 140], [120, 50],
    [-150, -120], [-40, -130], [70, -140], [150, -20],
    [150, 140], [-140, 150],
  ];
  blocks.forEach(([x, z], i) => {
    out.push({
      x,
      z,
      w: 22 + (i % 3) * 6,
      d: 16 + (i % 4) * 4,
      h: 8 + (i % 5) * 4,
      color: ['#2a3140', '#34302c', '#243044', '#3a332e', '#1e2a32'][i % 5],
    });
  });
  return out;
}

export function poiAt(x: number, z: number): Poi | null {
  for (const p of POIS) {
    if (Math.abs(x - p.x) < p.w * 0.7 && Math.abs(z - p.z) < p.d * 0.7) return p;
  }
  return null;
}

export function travelMinutes(from: string, to: string): number {
  const a = POIS.find((p) => p.id === from) ?? POIS[0];
  const b = POIS.find((p) => p.id === to) ?? POIS[0];
  const dist = Math.hypot(a.x - b.x, a.z - b.z);
  return Math.max(4, Math.round(dist / 18));
}
