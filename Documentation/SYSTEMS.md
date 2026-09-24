# Systems

Each folder under `Source/` is a system. They meet in `GameState` and in `actions.ts`. Do not fold them back into one file.

| Folder | What it owns |
| --- | --- |
| Core | Types, RNG, clock, money format, i18n |
| Vehicles | Models, assembly slots, factory, analysis |
| VehicleParts | Catalogue, `createPart`, fit rules |
| Physics | Powertrain, grip, weather and surface, the integrator |
| Garage | Bay counts live with tools; the 3D bay is in Render |
| Mechanics | Work is scheduled in actions and finished in `finishTask` |
| Diagnostics | Clues, scan codes and start reasons come from analysis |
| Inventory | Part instances on `state.parts`, ids on `garage.inventory` |
| Economy | Cash, debt, tax, ledger |
| Market | Quotes, featured stock, listings, prices |
| Customers | Names and personalities on orders |
| Orders | Templates, outcome checks, grading |
| Employees | Wages, candidates, shift tasks |
| AI | Rival bids and sale rolls live in the tick |
| World | City POIs, travel time, building boxes |
| Weather | Sky, grip, ambient temperature |
| UI | Menu, HUD, panels. English menu strings are fixed |
| Audio | Engine, rain, shop, UI blips |
| SaveSystem | Slots and version gate |
| Progression | Reputation titles, milestones, objectives |
| Customization | Paint, dirt, wash, colours |
| Tuning | ECU, ride, aero, dyno, alignment |
| Tools | Tool and upgrade definitions |
| Game | New game, tick, commands |
| Render | Three.js view. Not imported by the simulation |

## Loop the verifier runs

`npm run verify` creates a normal game and checks, in order:

- starter cash and car, hidden faults, offers, tools
- the starter does not fire, and the battery is the weak part
- a brake disc cannot come off with the wheel still on
- inspect, order, delivery, remove, install, start
- an oil job on a customer car, with a jack on FL rather than the lift
- a part that actually fits that car’s size
- delivery, reputation, a faster sports car, lower grip in rain
- save round-trip and a rejected bad version
- a week of clock and a ledger that moved

If a check fails, the message is the assertion name. Do not “fix” it by lowering a threshold that the design depends on. The normal starter battery is 11 and must not crank. Oil does not require the lift. Electric cars do not receive oil, misfire, overheat or no-start jobs.

## Player commands

Panels call `data-cmd` with JSON args. `Source/main.ts` either handles a shell command (`start-new`, `save-slot`, `start-drive`, `wait-delivery`) or forwards the name to `runCommand`. Commands that need the RNG — `acceptJob`, `resolveEvent`, `searchStaff` — receive it inside `runCommand`, not from the button.

## Driving

`stepVehicle` integrates in metres and seconds. Heading 0 is +Z on the pad. City roads are the cross at x=0 and z=0. Rain, heavy rain, snow, dirt and runoff change `DriveEnv`. Leaving the drive calls `commitRun`, which writes fuel, odometer, tyre and pad wear, and telemetry. A 0–100 and a quarter mile are recorded only on the pad.
