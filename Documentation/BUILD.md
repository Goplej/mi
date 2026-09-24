# Build

Requirements: Node 20+.

```bash
npm install
npm run typecheck
npm run verify
npm run build
```

`npm run build` typechecks, then writes a static release to `Builds/web`. Open `Builds/web/index.html` only through a static server or `npm run preview`. `file://` will not load the module.

`npm run dev` serves the same entry with Vite on `0.0.0.0:5173`.

## Desktop shell

`Game/main.cjs` loads `Builds/web/index.html` in Electron and exposes `window.garageEmpire.quit` through `Game/preload.cjs`. The Exit item calls that when the shell is present, and otherwise asks the browser window to close.

`npm run desktop:pack` builds the web release and, if Electron can be packed in this environment, writes a Windows folder under `Builds/windows`. The expected executable name is `GarageEmpire.exe`. Cross-compilation needs the Electron binary and a Windows target; if the packager cannot fetch it, the web release is still the shipping build and the script says so.

## What “release” means here

The simulation is not behind a dev flag. Saves use the same `importState` the game uses. `Tools/verify.ts` is the regression check for the loop in section 36 of the design: data and rules first, then the view. A green `npm run verify` plus a green `npm run build` is the release gate.
