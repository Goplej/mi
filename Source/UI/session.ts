import type { Body, Powertrain } from '../Physics/dynamics';
import type { WeatherKind } from '../Core/types';

export type Mode = 'menu' | 'garage' | 'city' | 'track';

export interface DriveState {
  place: 'track' | 'city';
  body: Body;
  pt: Powertrain;
  t: number;
  zero: number | null;
  quarter: number | null;
  brakeStart: number | null;
  brakeDist: number | null;
  top: number;
  lateral: number;
  weather: WeatherKind;
  lights: boolean;
  surface: string;
}

export interface Session {
  mode: Mode;
  panel: string | null;
  selectedId: string | null;
  selectedSlot: string | null;
  menu: 'main' | 'new' | 'load' | 'settings' | 'credits' | 'exit';
  toast: string;
  toastKind: 'info' | 'good' | 'bad' | 'warn';
  drive: DriveState | null;
  steer: number;
  throttle: number;
  brake: number;
  handbrake: number;
  interact: string | null;
  group: string;
  pausedMenu: boolean;
}

export function freshSession(): Session {
  return {
    mode: 'menu',
    panel: null,
    selectedId: null,
    selectedSlot: null,
    menu: 'main',
    toast: '',
    toastKind: 'info',
    drive: null,
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: 0,
    interact: null,
    group: 'all',
    pausedMenu: false,
  };
}
