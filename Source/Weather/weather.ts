import type { GameState, WeatherKind } from '../Core/types';
import { RNG } from '../Core/rng';
import { seasonOf } from '../Core/util';

export function rollWeather(state: GameState, rng: RNG): void {
  const day = Math.floor(state.clock.absolute / 1440) + 1;
  const season = seasonOf(day);
  state.market.season = season;
  const bag: { item: WeatherKind; w: number }[] = [
    { item: 'clear', w: season === 'summer' ? 5 : 3 },
    { item: 'cloudy', w: 3 },
    { item: 'rain', w: season === 'summer' ? 1.2 : 2 },
    { item: 'heavy-rain', w: 0.6 },
    { item: 'fog', w: season === 'autumn' ? 1.6 : 0.5 },
    { item: 'snow', w: season === 'winter' ? 2.4 : 0.05 },
  ];
  if (rng.chance(0.55)) {
    state.weather.kind = rng.weighted(bag);
    state.weather.until = state.clock.absolute + rng.int(8, 30) * 60;
    state.weather.wind = rng.float(0.2, 1);
  }
}

export function timeOfDay(absolute: number): 'night' | 'dawn' | 'day' | 'dusk' {
  const h = Math.floor((absolute % 1440) / 60);
  if (h < 5 || h >= 21) return 'night';
  if (h < 8) return 'dawn';
  if (h >= 18) return 'dusk';
  return 'day';
}

export function sunColor(absolute: number): { sky: string; light: string; intensity: number; ambient: number } {
  const phase = timeOfDay(absolute);
  if (phase === 'night') return { sky: '#070b14', light: '#8aa4ff', intensity: 0.08, ambient: 0.18 };
  if (phase === 'dawn') return { sky: '#c47a62', light: '#ffb089', intensity: 0.55, ambient: 0.38 };
  if (phase === 'dusk') return { sky: '#b85a3d', light: '#ff8a55', intensity: 0.42, ambient: 0.32 };
  return { sky: '#8eb4d6', light: '#fff4df', intensity: 1, ambient: 0.55 };
}

export function ambientTemp(state: GameState): number {
  const season = state.market.season;
  const base = season === 'winter' ? -2 : season === 'summer' ? 24 : season === 'spring' ? 12 : 10;
  if (state.weather.kind === 'snow') return Math.min(base, -1);
  if (state.weather.kind === 'heavy-rain') return base - 3;
  return base;
}
