# GARAGE EMPIRE

Симулятор мастерской, реставрации и небольшой автомобильной империи. Игрок начинает с одного бокса, старой машины и небольшой кассы. Дальше — осмотр, скрытые неисправности, заказ деталей, сборка, запуск, заезд, заказ клиента, расширение, штат и рынок.

This is a workshop, restoration and small-empire simulator. One bay, an old car, and a thin wallet. Inspection, hidden faults, parts orders, assembly, a start, a test run, a customer job, then expansion, staff and the market.

Марки выдуманы: Drava, Vespera, Solara, Kaluga, Nordheim, Marcelli, Helix, Ashford, Aurion, Vektor. Чужих товарных знаков в игре нет.

## Play

```bash
npm install
npm run dev
```

Откройте показанный адрес. Сборка для запуска без исходников:

```bash
npm run build
npm run preview
```

Готовые файлы лежат в `Builds/web`. Меню: **GARAGE EMPIRE** — Continue, New Game, Load Game, Settings, Credits, Exit.

## The first hour

1. Новая игра. Стартовая Drava Kombi уже в боксе и на нормальной сложности не заводится: аккумулятор слабый.
2. Откройте капот, осмотрите аккумулятор, закажите замену, дождитесь поставки (или нажмите «Ждать поставку»), снимите старый, поставьте новый, поверните ключ.
3. Возьмите заказ на масло. Машину клиента загоните в свободный бокс: свою сначала на парковку. Домкрат на FL и открытый капот открывают фильтр и масло. Подъёмник для этого не нужен.
4. Сдайте заказ из бокса. На деньги купите инструмент или подъёмник.
5. Когда машина на ходу, кнопка «Площадка» открывает заезд. WASD — газ, тормоз, руль. Пробел — ручник. F — свет. E — войти в точку города. Дождь и снег режут сцепление.

Время идёт само. `II` ставит паузу, `12×` и «Дождаться конца» не заставляют сидеть над каждой минутой ремонта.

## Saves

Шесть слотов в `localStorage`: автосохранение `0` и ручные `1–5`. Версия сохранения проверяется. Битый файл не подменяет текущую игру.

## Desktop

`Game/main.cjs` — оболочка Electron поверх `Builds/web`. Сборка Windows, если в среде есть Electron:

```bash
npm run build
npm run desktop:pack
```

Исполняемый файл ожидается как `Builds/windows/GarageEmpire.exe`, когда упаковщик может скачать Electron. В этой среде сертификат загрузки Electron не прошёл проверку, поэтому exe не собран. Гарантированный выпуск — `Builds/web`.

## Layout

```
Assets/data/     vehicles, parts, jobs, tools
Source/          simulation, renderer, UI, audio
Documentation/   how the systems connect
Tools/verify.ts  headless loop: inspect, buy, install, start, job, save
Builds/web/      release build
```

Проверка симуляции без браузера: `npm run verify`. Проверка типов: `npm run typecheck`.
