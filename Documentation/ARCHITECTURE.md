# Architecture

Garage Empire is one simulation and one picture of it. The picture never owns the rules.

## Boundary

`Source/Game/game.ts` is the only object the UI and the test harness need. `Game.create` and `Game.fromSave` build a `GameState`. `Game.update(seconds, driving)` advances the clock unless the player is driving or the clock is paused. `runCommand(game, name, ...args)` calls a function in `Source/Game/actions.ts` and writes the RNG back.

`Tools/verify.ts` imports `Game` and must not import `three` or the DOM. `Source/main.ts` is the only browser entry. Vite builds it to `Builds/web`.

## Time

`state.clock.absolute` is minutes since day 1, 00:00. The new game starts at 08:00. One real second advances `clock.speed` game minutes. Work tasks, deliveries, weather, rent, wages, tax, auctions and random events all read that clock. Driving freezes it so a lap is not also a week of rent.

## Data

`Assets/data/vehicles.json`, `parts.json` and `content.json` are the catalogues. Brands and models are original. A part is not a row in a table of every possible SKU: `createPart` builds an instance from type, size, quality and brand, and `fitsVehicle` decides whether it can enter a slot. OEM parts are brand-locked. Everything else is tagged `universal`.

## Vehicles

`expectedSlots` / `slotsFor` describe what a model can hold. Electric cars do not get an oil pan, plugs or a starter. Turbo cars get a turbo slot. Access rules live on the slot: hood, trunk, door, jack corner, lift, or a part that must already be off. The lift is an upgrade. The starter jack is enough for a wheel and for the oil filter.

`analyze` is the truth the rest of the sim reads: power, grip, whether it fires, symptoms, codes. The UI must not print a part’s condition until that slot has been inspected or the car has been scanned. The number exists in state; it is hidden on purpose.

## Money and people

Cash, debt, tax, rent and power go through the ledger. Customer orders are templates with outcome ids. `gradeOrder` scores the car at delivery; the invoice cannot ignore the budget or a late clock. Staff have a task of their own and only work the shift, unless overtime is on.

## Picture and sound

`Source/Render` builds a procedural car, a bay that grows with upgrades, a small city and a pad. Materials are `MeshPhysicalMaterial` with a generated clearcoat, roughness and a room environment. `Source/Audio` is WebAudio: two oscillators plus noise for the engine, filtered noise for rain and the shop. Nothing is loaded from a trademarked car model.

## Saves

`exportState` / `importState` check `SAVE_VERSION` and the shape. Slots are `garage-empire-autosave` and `garage-empire-slot-1` … `5`. A bad version throws. The UI catches that and leaves the running game alone.
