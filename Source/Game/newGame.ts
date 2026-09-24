import type { Difficulty, GameState, Lang } from '../Core/types';
import { SAVE_VERSION } from '../Core/types';
import { RNG } from '../Core/rng';
import { defaultSettings } from '../SaveSystem/save';
import { createStarter } from '../Vehicles/factory';
import { createOffer } from '../Orders/logic';

export interface NewGameOptions {
  company: string;
  boss: string;
  difficulty: Difficulty;
  seed?: number;
  lang?: Lang;
}

export function createNewGame(opts: NewGameOptions): GameState {
  const seed = opts.seed && opts.seed !== 0 ? opts.seed : (Math.floor(Math.random() * 1_000_000_000) || 1);
  const difficulty = opts.difficulty;
  const cash = difficulty === 'easy' ? 20000 : difficulty === 'hard' ? 4500 : 8500;
  const rep = difficulty === 'easy' ? 70 : difficulty === 'hard' ? 18 : 36;
  const settings = defaultSettings();
  if (opts.lang) settings.lang = opts.lang;
  const state: GameState = {
    version: SAVE_VERSION,
    seq: 1,
    rng: seed,
    meta: {
      company: (opts.company || 'Северный гараж').slice(0, 28),
      boss: (opts.boss || 'Механик').slice(0, 24),
      difficulty,
      seed,
      createdAt: Date.now(),
      playSeconds: 0,
      empireAnnounced: false,
      bankrupt: false,
    },
    settings,
    clock: { absolute: 8 * 60, speed: 3, paused: false },
    economy: {
      cash,
      debt: 0,
      interestRate: 0.012,
      negativeSince: null,
      taxDue: 0,
      ledger: [],
      lifetimeRevenue: 0,
      lifetimeExpenses: 0,
      weeklyRent: 0,
      powerBill: 0,
    },
    reputation: rep,
    reviews: [],
    garage: {
      upgrades: [],
      tools: ['wrench', 'screwdriver', 'jack', 'multimeter'],
      inventory: [],
      deliveries: [],
      bays: 1,
      parking: 3,
    },
    vehicles: [],
    parts: {},
    orders: [],
    employees: [],
    candidates: [],
    market: {
      index: 1,
      demand: {
        economy: 1,
        family: 1,
        sport: 1,
        suv: 1,
        classic: 0.9,
        premium: 0.85,
        supercar: 0.7,
        race: 0.6,
        utility: 0.95,
      },
      season: 'spring',
      categoryMul: {},
      deliveryMul: 1,
      featured: [],
      listings: [],
      junk: [],
      auctions: [],
      fuelPrice: 1.65,
      nextAuctionDay: 3,
    },
    weather: { kind: 'clear', until: 8 * 60 + 600, wind: 0.3 },
    events: [],
    notifications: [],
    milestones: [],
    flags: { playerSkill: 2, allowEmployeePurchases: false },
    stats: {
      carsBought: 0,
      carsSold: 0,
      ordersCompleted: 0,
      ordersFailed: 0,
      partsReplaced: 0,
      auctionsWon: 0,
      auctionsLost: 0,
      employeesHired: 0,
      distanceKm: 0,
      bestZeroTo100: null,
      projectsFinished: [],
      comebacks: 0,
    },
    work: { active: null, queue: [] },
    objectivesSeen: [],
    setups: [],
    collectionSold: [],
  };
  const rng = new RNG(seed);
  const starter = createStarter(state, rng, difficulty);
  starter.repairLog.push({
    at: 0,
    text: { ru: '2016, чужой сервис: глушитель. Больше записей нет.', en: '2016, another shop: a muffler. No other records.' },
    cost: 0,
  });
  createOffer(state, rng, 'oil_service');
  createOffer(state, rng, 'lights');
  state.notifications.push({
    id: 'note_welcome',
    at: state.clock.absolute,
    kind: 'info',
    read: false,
    text: {
      ru: `${state.meta.company}: бокс, старый Drava Kombi и два предложения от клиентов. Неисправности скрыты, пока вы их не найдёте.`,
      en: `${state.meta.company}: a bay, an old Drava Kombi and two customer offers. Faults stay hidden until you find them.`,
    },
  });
  state.rng = rng.seed;
  return state;
}
