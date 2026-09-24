export const SAVE_VERSION = 1;

export type Lang = 'ru' | 'en';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Quality = 'used' | 'aftermarket' | 'oem' | 'performance' | 'racing';
export type ConditionState = 'new' | 'good' | 'worn' | 'damaged' | 'critical' | 'failed';
export type VehicleClass =
  | 'economy'
  | 'family'
  | 'sport'
  | 'suv'
  | 'classic'
  | 'premium'
  | 'supercar'
  | 'race'
  | 'utility';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type BodyStyle =
  | 'sedan'
  | 'hatch'
  | 'wagon'
  | 'coupe'
  | 'suv'
  | 'supercar'
  | 'classic'
  | 'muscle'
  | 'van'
  | 'pickup'
  | 'roadster';
export type DriveLayout = 'FWD' | 'RWD' | 'AWD';
export type Powertrain = 'ice' | 'electric';
export type EngineArch = 'i3' | 'i4' | 'i6' | 'v6' | 'v8' | 'v10' | 'v12' | 'electric';
export type Aspiration = 'na' | 'turbo' | 'twin-turbo' | 'electric';
export type FuelType = 'petrol' | 'diesel' | 'electric';
export type GearboxKind = 'manual' | 'automatic' | 'dct' | 'single';
export type PartSize = 'light' | 'medium' | 'heavy' | 'sport';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'heavy-rain' | 'fog' | 'snow';
export type Role =
  | 'mechanic'
  | 'diagnostician'
  | 'bodyworker'
  | 'electrician'
  | 'painter'
  | 'manager'
  | 'salesperson'
  | 'administrator';
export type Location =
  | 'yard'
  | 'parking'
  | 'showroom'
  | 'offsite'
  | `bay:${number}`;

export interface L10n {
  ru: string;
  en: string;
}

export interface EngineSpec {
  arch: EngineArch;
  displacement: number;
  aspiration: Aspiration;
  power: number;
  torque: number;
  redline: number;
  idle: number;
  fuel: FuelType;
}

export interface VisualHints {
  grille: string;
  lights: string;
  wing?: boolean;
  chrome?: boolean;
  stripes?: boolean;
  brandColor: string;
}

export interface ModelDef {
  id: string;
  brand: string;
  model: string;
  description: L10n;
  yearMin: number;
  yearMax: number;
  class: VehicleClass;
  body: BodyStyle;
  drive: DriveLayout;
  mass: number;
  rarity: Rarity;
  powertrain: Powertrain;
  engine: EngineSpec;
  gearbox: GearboxKind;
  gears?: number[];
  finalDrive?: number;
  wheelRadius?: number;
  wheelbase: number;
  length: number;
  width: number;
  height: number;
  drag: number;
  baseValue: number;
  size: PartSize;
  doors: number;
  brakeForce: number;
  grip: number;
  fuelTank: number;
  visual: VisualHints;
}

export interface PartTypeDef {
  id: string;
  category: string;
  group: string;
  name: L10n;
  basePrice: number;
  weight: number;
  minutes: number;
  tools: string[];
  wear: number;
  consumable: boolean;
  repairable: boolean;
  sizes: PartSize[];
  stats: Record<string, number>;
  system: string;
  critical?: boolean;
  rare?: boolean;
  internal?: boolean;
}

export interface QualityDef {
  id: Quality;
  price: number;
  stat: number;
  wear: number;
  delivery: number;
  cond: [number, number];
  weight: number;
}

export interface ToolDef {
  id: string;
  name: L10n;
  description: L10n;
  price: number;
  grants: string;
}

export interface UpgradeDef {
  id: string;
  name: L10n;
  description: L10n;
  price: number;
  upkeep: number;
  requires: string[];
  rep?: number;
  grants?: string[];
  bays?: number;
}

export interface SlotAccess {
  panel?: 'hood' | 'trunk' | 'door';
  lift?: boolean;
  jackCorner?: string;
  removed?: string[];
}

export interface SlotSpec {
  id: string;
  type: string;
  group: string;
  name: L10n;
  size: PartSize;
  tools: string[];
  minutes: number;
  access: SlotAccess;
  optional?: boolean;
  system: string;
  corner?: string;
}

export interface PartInstance {
  uid: string;
  defKey: string;
  type: string;
  name: L10n;
  manufacturer: string;
  quality: Quality;
  size: PartSize;
  brand: string | null;
  tags: string[];
  condition: number;
  mileage: number;
  weight: number;
  stats: Record<string, number>;
  wear: number;
  consumable: boolean;
  repairable: boolean;
  installedIn: string | null;
  slot: string | null;
  purchasedAt: number;
  purchasePrice: number;
}

export interface OwnerRecord {
  name: string;
  fromYear: number;
  toYear: number;
  note: L10n;
}

export interface RepairLogEntry {
  at: number;
  text: L10n;
  cost: number;
}

export interface Clue {
  id: string;
  source: 'visual' | 'sound' | 'scan' | 'multimeter' | 'compression' | 'testdrive' | 'idle' | 'history';
  text: L10n;
  system: string;
  at: number;
}

export interface Telemetry {
  at: number;
  zeroTo100: number | null;
  quarterMile: number | null;
  brake100: number | null;
  topSpeed: number;
  maxRpm: number;
  maxTemp: number;
  maxLateral: number;
  distanceKm: number;
  weather: WeatherKind;
  surfaceNote: L10n;
}

export interface DynoResult {
  at: number;
  peakPower: number;
  peakTorque: number;
  curve: { rpm: number; hp: number; tq: number }[];
}

export interface VehicleTune {
  ecuPower: number;
  ride: number;
  aero: number;
}

export interface VehiclePanels {
  hood: boolean;
  trunk: boolean;
  doors: Record<string, boolean>;
  lift: boolean;
  jack: string | null;
}

export interface VehicleRuntime {
  running: boolean;
  rpm: number;
  temp: number;
  throttle: number;
}

export interface VehicleInstance {
  id: string;
  vin: string;
  modelId: string;
  year: number;
  odometer: number;
  trueOdometer: number;
  color: string;
  paintCondition: number;
  dirt: number;
  fuel: number;
  role: 'owned' | 'customer' | 'market' | 'auction' | 'junk';
  location: Location;
  slots: Record<string, string | null>;
  inspected: string[];
  clues: Clue[];
  scanned: boolean;
  deepScanned: boolean;
  owners: OwnerRecord[];
  repairLog: RepairLogEntry[];
  purchasedPrice: number;
  acquiredAt: number;
  listingPrice?: number;
  orderId?: string;
  projectId?: string;
  projectTitle?: L10n;
  aligned: boolean;
  tune: VehicleTune;
  telemetry: Telemetry[];
  dyno?: DynoResult;
  panels: VehiclePanels;
  runtime: VehicleRuntime;
  lights: boolean;
  notes: string;
  suspected: string[];
  serviceStamp: number;
}

export interface Offer {
  id: string;
  defKey: string;
  type: string;
  size: PartSize;
  quality: Quality;
  brand: string | null;
  name: L10n;
  manufacturer: string;
  price: number;
  deliveryHours: number;
  condition: number;
  stock: number;
  featured: boolean;
  rare: boolean;
}

export interface Delivery {
  id: string;
  eta: number;
  offer: Offer;
  rushed: boolean;
}

export interface Listing {
  id: string;
  vehicleId: string;
  asking: number;
  seller: 'private' | 'dealer' | 'junkyard' | 'player';
  inspected: boolean;
  note: L10n;
  listedAt: number;
  expiresAt: number;
  systemPeek?: Record<string, number>;
}

export interface AuctionLot {
  id: string;
  vehicleId: string;
  currentBid: number;
  leader: 'player' | 'ai' | 'none';
  aiMax: number;
  inspected: boolean;
  history: { who: string; amount: number; at: number }[];
  hold: number;
}

export interface Auction {
  id: string;
  startsAt: number;
  endsAt: number;
  lots: AuctionLot[];
  resolved: boolean;
  title: L10n;
}

export interface OrderOutcome {
  id: string;
  text: L10n;
  param?: number;
}

export interface Order {
  id: string;
  templateId: string;
  customer: string;
  personality: 'calm' | 'picky' | 'rushed' | 'vip' | 'racer' | 'collector';
  title: L10n;
  brief: L10n;
  say: L10n;
  budget: number;
  payoutBase: number;
  deadline: number;
  acceptedAt?: number;
  status: 'offered' | 'active' | 'done' | 'failed' | 'expired' | 'declined';
  vehicleId: string;
  outcomes: OrderOutcome[];
  difficulty: number;
  reputationWeight: number;
  invoice: number;
  paintColor?: string;
  createdAt: number;
  finishedAt?: number;
  score?: number;
  review?: L10n;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  level: number;
  xp: number;
  speed: number;
  quality: number;
  wage: number;
  morale: number;
  assignedBay: number | null;
  overtime: boolean;
  task: WorkTask | null;
  jobsDone: number;
}

export interface WorkTask {
  id: string;
  type: string;
  vehicleId?: string;
  slot?: string;
  partUid?: string;
  extra?: Record<string, string | number>;
  remaining: number;
  total: number;
  label: L10n;
  actor: 'player' | string;
}

export interface LedgerEntry {
  at: number;
  amount: number;
  category: string;
  text: L10n;
}

export interface Review {
  at: number;
  customer: string;
  stars: number;
  text: L10n;
  orderId?: string;
}

export interface GameEvent {
  id: string;
  kind: string;
  title: L10n;
  text: L10n;
  at: number;
  until: number;
  resolved: boolean;
  choices?: { id: string; label: L10n }[];
  payload?: Record<string, string | number>;
}

export interface Notification {
  id: string;
  at: number;
  kind: 'info' | 'good' | 'bad' | 'warn';
  text: L10n;
  read: boolean;
}

export interface Milestone {
  id: string;
  at: number;
  title: L10n;
}

export interface Settings {
  lang: Lang;
  quality: 'low' | 'medium' | 'high';
  master: number;
  engineVol: number;
  ambience: number;
  uiVol: number;
  shake: boolean;
  hints: boolean;
  autosave: boolean;
  invert: boolean;
}

export interface Meta {
  company: string;
  boss: string;
  difficulty: Difficulty;
  seed: number;
  createdAt: number;
  playSeconds: number;
  empireAnnounced: boolean;
  bankrupt: boolean;
}

export interface Clock {
  absolute: number;
  speed: number;
  paused: boolean;
}

export interface Economy {
  cash: number;
  debt: number;
  interestRate: number;
  negativeSince: number | null;
  taxDue: number;
  ledger: LedgerEntry[];
  lifetimeRevenue: number;
  lifetimeExpenses: number;
  weeklyRent: number;
  powerBill: number;
}

export interface MarketState {
  index: number;
  demand: Record<string, number>;
  season: Season;
  categoryMul: Record<string, number>;
  deliveryMul: number;
  featured: Offer[];
  listings: Listing[];
  junk: Listing[];
  auctions: Auction[];
  fuelPrice: number;
  nextAuctionDay: number;
}

export interface GarageState {
  upgrades: string[];
  tools: string[];
  inventory: string[];
  deliveries: Delivery[];
  bays: number;
  parking: number;
}

export interface Stats {
  carsBought: number;
  carsSold: number;
  ordersCompleted: number;
  ordersFailed: number;
  partsReplaced: number;
  auctionsWon: number;
  auctionsLost: number;
  employeesHired: number;
  distanceKm: number;
  bestZeroTo100: number | null;
  projectsFinished: string[];
  comebacks: number;
}

export interface GameState {
  version: number;
  seq: number;
  rng: number;
  meta: Meta;
  settings: Settings;
  clock: Clock;
  economy: Economy;
  reputation: number;
  reviews: Review[];
  garage: GarageState;
  vehicles: VehicleInstance[];
  parts: Record<string, PartInstance>;
  orders: Order[];
  employees: Employee[];
  candidates: Employee[];
  market: MarketState;
  weather: { kind: WeatherKind; until: number; wind: number };
  events: GameEvent[];
  notifications: Notification[];
  milestones: Milestone[];
  flags: Record<string, number | string | boolean>;
  stats: Stats;
  work: { active: WorkTask | null; queue: WorkTask[] };
  objectivesSeen: string[];
  setups: { name: string; modelId: string; notes: string; tune: VehicleTune; parts: Record<string, string> }[];
  collectionSold: { modelId: string; vin: string; price: number; at: number }[];
}

export interface ActionResult {
  ok: boolean;
  message?: L10n;
  minutes?: number;
  data?: unknown;
}

export interface Appraisal {
  market: number;
  dealer: number;
  privateAsk: number;
  breakdown: { label: L10n; factor: number }[];
  conditionScore: number;
}

export interface SystemView {
  id: string;
  health: number;
  knowledge: 'unknown' | 'suspected' | 'known';
}
