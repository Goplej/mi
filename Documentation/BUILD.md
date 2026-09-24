# Build

Requirements: Node.js 22.12+ and npm.

```bash
npm ci
npm run typecheck
npm run verify
npm run build
```

`npm run build` typechecks, then writes a static release to `Builds/web`. Open `Builds/web/index.html` only through a static server or `npm run preview`; `file://` will not load the web modules.

`npm run dev` serves the game with Vite on `0.0.0.0:5173`.

## Windows desktop

```bash
npm run desktop:pack
```

This rebuilds the web assets and packages the game with the pinned Electron runtime for Windows x64. The executable is:

```text
Builds/windows/GarageEmpire-win32-x64/GarageEmpire.exe
```

This is a portable application **folder**, not a standalone executable. Keep the whole folder together. The first local package may need to download Electron from the official distribution host; do not disable TLS verification to work around a blocked download.

The `Windows desktop` GitHub Actions workflow builds and tests the app on Windows for pushes to `main` and `arena/**`, and for pull requests to `main`. Each run keeps a ZIP artifact for 14 days. To attach a build to a GitHub Release, manually run the workflow on the chosen source branch and enter an existing release tag (for example, `v1.0.0`). The release receives `GarageEmpire-windows-x64.zip` and its SHA-256 checksum.

The checked-in project intentionally does not contain generated desktop binaries. `Builds/windows/` is ignored by Git.

## What “release” means here

The simulation is not behind a dev flag. Saves use the same `importState` the game uses. `Tools/verify.ts` is the regression check for the loop in section 36 of the design: data and rules first, then the view. A green `npm run verify` plus a green `npm run build` is the web release gate; the Windows workflow additionally packages the desktop app on a native Windows runner.
