# ScriptCraft

JavaScript scripting for **Minecraft 1.12.2 / Forge 14.23.5.2859**.

Drop `.js` files into `.minecraft/scriptcraft/scripts`, then run them from the game with
`/script run <file>` or from the in-game IDE (key `K`). Scripts get a real JavaScript engine
— Nashorn, the one that ships with the Java 8 runtime Minecraft 1.12.2 requires — plus an API
for the player, the world, blocks, entities, events, timers and the console.

```js
// .minecraft/scriptcraft/scripts/example.js
console.log("Hello from example.js");
player.sendMessage("ScriptCraft loaded successfully!");
```

```
/script run example.js
```

## Features

* **Real JavaScript engine.** Nashorn from the JDK 8 JRE. No custom parser, no
  JavaScript-lookalike, no extra runtime dependency to download.
* **`/script` command.** `help`, `list`, `run`, `stop`, `reload`, `reloadall`, `info`, `new`, `ide`.
* **Per-script isolation.** Every script gets its own engine, context, timers and event
  listeners. `/script stop example.js` releases only that script's timers and listeners.
* **Reload that actually reloads.** Stops the old version, drops its listeners, cancels its
  timers, clears the bindings, builds a fresh context, re-reads the file and runs it.
* **Errors never crash the game.** A script error is reported with the file, the line and the
  message, logged, and the server keeps running.
* **Event API** for join, quit, chat (cancel/rewrite), block break/place, death, entity spawn
  and server tick.
* **Timer API** — `timer.after(ms, fn)`, `timer.every(ms, fn)`, `timer.cancel(id)` — with
  per-tick budgets so a bad script cannot stall the server.
* **Sandboxed by default.** Java interop is switched off (`--no-java`), the engine binding and
  the scripting globals are removed, and a scoped `SecurityManager` denies process execution
  and JVM shutdown while a script runs.
* **Path traversal guard.** Every file name is resolved against
  `.minecraft/scriptcraft/scripts` and rejected if it escapes — no `../`, no absolute paths.
* **Client/server safe.** `Minecraft.getMinecraft()` is only ever touched from client-only
  classes behind `@SideOnly(Side.CLIENT)`; on a dedicated server the player API degrades
  instead of crashing.
* **In-game IDE** (key `K`) with a file list, a text editor and a console.

## Installation

1. Install Minecraft 1.12.2 with Forge 14.23.5.2859.
2. Copy `build/libs/ScriptCraft-0.1.0.jar` into your `mods` folder.
3. Start the game. ScriptCraft creates its folders and logs:

```
[ScriptCraft] Initializing...
[ScriptCraft] Scripts directory: /home/you/.minecraft/scriptcraft/scripts
[ScriptCraft] Sandbox active (no Java interop, no process execution, no JVM shutdown from scripts)
[ScriptCraft] Script engine initialized (Oracle Nashorn 1.8.0_144)
[ScriptCraft] Created example script: example.js
[ScriptCraft] ScriptCraft loaded successfully!
```

## Layout created on first run

```
.minecraft/scriptcraft/
├── scripts/                    your .js files (the six examples are copied here)
├── config/scriptcraft.properties
└── logs/scriptcraft-YYYY-MM-DD.log
```

## Commands

| Command | What it does |
| --- | --- |
| `/script help` | Show this list |
| `/script list` | Every `.js` file with its state: `[RUNNING]`, `[ERROR]`, `[STOPPED]` |
| `/script run <file>` | Load and execute a script |
| `/script stop <file>` | Stop it, cancel its timers, remove its listeners, clear its bindings |
| `/script reload <file>` | Stop + run again, picking up edits from disk |
| `/script reloadall` | Reload every loaded script |
| `/script info <file>` | State, size, timer and listener counts, uptime, last error |
| `/script new <file>` | Create an empty script |
| `/script ide` | Open the IDE (client only) |

Tab completion works for subcommands and for file names. Errors are always reported in the
same shape, never thrown at the game:

```
Script error
File: myscript.js
Line: 3
Error: ReferenceError: "nope" is not defined in myscript.js at line number 3
```

By default the command needs permission level 2 (op); on an integrated server the local
player may always use it. Both are configurable.

## The API in one screen

| Binding | Highlights |
| --- | --- |
| `player` | `sendMessage`, `getName`, `getX/getY/getZ`, `getHealth`, `setHealth`, `getFoodLevel`, `getHeldItem`, `teleport`, `giveItem`, `isSneaking`, `isSprinting`, `getWorld` |
| `world` | `getName`, `getDimension`, `getBlock`, `setBlock`, `isAir`, `getPlayers`, `getEntities`, `getTime/setTime` |
| `blocks` | `get`, `set`, `nameAt`, `idOf`, `exists`, `isAir` |
| `entities` | `spawn`, `getNearby`, `nearbyTypes`, `count` |
| `server` | `broadcast`, `getPlayer`, `getPlayers`, `getPlayerCount`, `runCommand`, `getTick`, `isDedicated` |
| `events` | `onPlayerJoin`, `onPlayerQuit`, `onPlayerChat`, `onPlayerBreakBlock`, `onPlayerPlaceBlock`, `onPlayerDeath`, `onEntitySpawn`, `onTick` |
| `timer` | `after(ms, fn)`, `every(ms, fn)`, `cancel(id)`, `active()` |
| `console` | `log`, `info`, `warn`, `error` — written to the Forge log as `[ScriptCraft:example.js] …` |
| `scriptcraft` | `getVersion`, `getMcVersion`, `getScript`, `getScriptsDir`, `listScripts`, `isClient` |

Full reference: [docs/api.md](docs/api.md) · events: [docs/events.md](docs/events.md) ·
timers: [docs/timers.md](docs/timers.md) · more examples: [docs/examples.md](docs/examples.md) ·
first steps: [docs/getting-started.md](docs/getting-started.md).

## Building

Java 8 is required (Forge 1.12.2 and Nashorn both need it).

```bash
./gradlew clean
./gradlew build          # -> build/libs/ScriptCraft-0.1.0.jar
./gradlew runClient      # try it in a client
./gradlew runServer      # try it on a dedicated server
```

The first run downloads ForgeGradle, the MCP mappings and the Forge userdev artifact from
`maven.minecraftforge.net`; that network access has to work.

### Offline verification

`gradlew build` needs the Forge/MCP artifacts from the internet. Where that is not available,
`dev-verify/verify.sh` compiles the mod against compile-time stand-ins for Minecraft and Forge
and then runs a harness that boots the real mod classes and drives them: `/script` subcommands,
Forge events posted on the real bus, server ticks, timers, the sandbox, path traversal, config
parsing, permission levels, the console sender, every bundled example, every ```js snippet in
these docs, and the IDE itself (key presses, clicks, buttons, Ctrl+S, delete confirmation,
server-thread hand-off):

```bash
./dev-verify/verify.sh      # PASSED: 211 FAILED: 0
```

It proves compilation with `-Xlint:all` against the Java 8 API (`javac 8`, or `javac --release 8`
on a newer JDK) and the behaviour of ScriptCraft's own logic, on the real Nashorn engine. It is
not Minecraft and it is not Gradle — in-game behaviour still has to be checked with `runClient`.
If the machine running the script has no JDK at all, `dev-verify/fetch-jdk.sh` downloads one for
the rig. See [dev-verify/README.md](dev-verify/README.md).

## Project layout

```
src/main/java/com/scriptcraft/
├── ScriptCraft.java          @Mod entry point: lifecycle, logging, example copying
├── core/                     constants, logger, config, thread and world lookup
├── engine/                   ScriptEngineManager, ScriptContext, TimerScheduler, results
├── api/                      the JS-facing objects (one class per namespace)
├── events/                   Forge event -> JavaScript bridge and listener registry
├── commands/                 /script
├── client/                   client proxy, key binding, in-game IDE  (@SideOnly CLIENT)
├── server/                   common proxy
├── filesystem/               directories, file IO, traversal guard
├── security/                 Nashorn sandbox
└── util/                     console buffer, editor model
```

`ScriptEngineManager` and everything below it knows nothing about Forge events; `EventBridge`
is the only class that translates Minecraft events into JavaScript calls.

## Security

Nashorn is not a security boundary and ScriptCraft does not claim to be a sandbox you can
hand untrusted strangers. What it does, by default:

* engines are created with `--no-java`, so `Java.type`, `Packages`, `java.*` and
  `Class.forName` are all unavailable;
* the `engine` binding and the `load`/`read`/`exit`/`quit`/`print` helpers are removed, so a
  script cannot reach the host engine or the JVM;
* while a script runs, a scoped `SecurityManager` denies process execution and JVM shutdown
  (Minecraft's own IO is untouched);
* file names may not escape `.minecraft/scriptcraft/scripts`;
* scripts only run for operators (permission level 2 by default).

Set `sandbox.enabled=false` in `config/scriptcraft.properties` only if you know why.

## Requirements

| | |
| --- | --- |
| Minecraft | 1.12.2 |
| Forge | 14.23.5.2859 |
| Java | 8 |
| Dependencies | none (Nashorn is in the JRE) |
