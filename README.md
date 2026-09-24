# GARAGE EMPIRE

Симулятор мастерской, реставрации и небольшой автомобильной империи. Игрок начинает с одного бокса, старой машины и небольшой кассы. Дальше — осмотр, скрытые неисправности, заказ деталей, сборка, запуск, заезд, заказ клиента, расширение, штат и рынок.

This is a workshop, restoration and small-empire simulator. One bay, an old car, and a thin wallet. Inspection, hidden faults, parts orders, assembly, a start, a test run, a customer job, then expansion, staff and the market.

Марки выдуманы: Drava, Vespera, Solara, Kaluga, Nordheim, Marcelli, Helix, Ashford, Aurion, Vektor. Чужих товарных знаков в игре нет.

## Play

Requirements: Node.js 22.12 or newer.

```bash
npm ci
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

## Desktop / Windows

Портативная Windows x64-сборка опубликована в [GitHub Releases](https://github.com/Goplej/mi/releases/tag/v1.0.0): скачайте `GarageEmpire-windows-x64.zip`, распакуйте **всю** папку и запустите `GarageEmpire-win32-x64/GarageEmpire.exe`. Не переносите exe отдельно: рядом с ним нужны остальные файлы приложения. Сборка не подписана сертификатом издателя, поэтому Windows SmartScreen может показать предупреждение.

Собрать локально (Node.js 22.12+):

```bash
npm ci
npm run desktop:pack
```

Результат: `Builds/windows/GarageEmpire-win32-x64/GarageEmpire.exe`. Скрипт сам обновляет `Builds/web`; для первой упаковки может понадобиться загрузка Electron. Рабочий процесс **Windows desktop** собирает ZIP и SHA-256 checksum на Windows runner. Чтобы загрузить сборку в уже существующий GitHub Release, запустите workflow вручную и укажите его тег, например `v1.0.0`.

`Builds/windows/` не добавляется в Git: готовая сборка доступна в релизе, а не в исходном репозитории.

## Layout

```
Assets/data/     vehicles, parts, jobs, tools
Source/          simulation, renderer, UI, audio
Documentation/   how the systems connect
Tools/verify.ts  headless loop: inspect, buy, install, start, job, save
Builds/web/      release build
Builds/windows/  portable Windows x64 app (generated, ignored by Git)
```

Проверка симуляции без браузера: `npm run verify`. Проверка типов: `npm run typecheck`.
