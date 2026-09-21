# Getting started

## 1. Install

1. Minecraft **1.12.2** with **Forge 14.23.5.2859**.
2. Copy `ScriptCraft-0.1.0.jar` into the `mods` folder.
3. Start the game.

The log shows what happened:

```
[ScriptCraft] Initializing...
[ScriptCraft] Scripts directory: /home/you/.minecraft/scriptcraft/scripts
[ScriptCraft] Sandbox active (no Java interop, no process execution, no JVM shutdown from scripts)
[ScriptCraft] Script engine initialized (Oracle Nashorn 1.8.0_144)
[ScriptCraft] Created example script: example.js
[ScriptCraft] ScriptCraft loaded successfully!
```

The same lines go to `scriptcraft/logs/scriptcraft-<date>.log`, except `Initializing...`, which
is logged before that folder exists and so only reaches the Forge log.

## 2. Where your scripts live

ScriptCraft creates this on first run and never writes outside it:

```
.minecraft/scriptcraft/
├── scripts/            <- your .js files
├── config/
│   └── scriptcraft.properties
└── logs/
    └── scriptcraft-2026-09-21.log
```

Six example scripts are copied into `scripts/` the first time (`example.js`, `welcome.js`,
`events.js`, `timer.js`, `blocks.js`, `test.js`). They are copied again only if they are
missing, so your edits are never overwritten.

## 3. Your first script

Open `scripts/example.js`:

```js
console.log("Hello from example.js");
player.sendMessage("ScriptCraft loaded successfully!");
```

In game:

```
/script run example.js
```

You should see the message in chat and the log line in `latest.log` /
`scriptcraft/logs/`. Now edit the file and run:

```
/script reload example.js
```

`reload` stops the old copy first — its timers are cancelled and its event listeners are
removed — so you never end up with two versions of the same script running.

## 4. A script that stays alive

A script that only sends a message is finished the moment it returns. To keep reacting to the
game, register a listener:

```js
events.onPlayerJoin(function (event) {
    event.player.sendMessage("Welcome, " + event.player.getName() + "!");
});
```

That script stays `RUNNING` until you stop it:

```
/script stop welcome.js
```

`stop` reports what it released, which is the quickest way to check a script is behaving:

```
Stopped welcome.js (timers cancelled: 0, listeners removed: 1)
```

## 5. Commands

| Command | Notes |
| --- | --- |
| `/script help` | |
| `/script list` | `[RUNNING]`, `[ERROR]` or `[STOPPED]` next to every file |
| `/script run <file>` | Refuses to run something already running — use `reload` |
| `/script stop <file>` | |
| `/script reload <file>` | |
| `/script reloadall` | Every loaded script |
| `/script info <file>` | Size, state, timers, listeners, uptime, last error |
| `/script new <file>` | |
| `/script ide` | Client only |

File names are relative to `scripts/` and must end in `.js`. `..`, absolute paths and drive
letters are rejected.

Who may use them: permission level 2 (op) by default. On an integrated server the local
player is always allowed, so you can develop in single player without opening the world to LAN.
Change `command.permissionLevel` in the config.

## 6. Reading errors

A broken script is reported, not thrown:

```
/script run broken.js

Script error
File: broken.js
Line: 3
Error: ReferenceError: "nope" is not defined in broken.js at line number 3
```

The same three lines go to the log. `/script info broken.js` keeps showing the last error, and
`/script list` shows the script as `[ERROR]`.

An error inside an *event listener* is logged the same way and only that listener call is
dropped — the tick, the event and the server continue.

## 7. The IDE

Press `K` (rebindable in Controls → ScriptCraft) to open the IDE.

* **Files** — the script list, plus New, Delete (asks for confirmation), Reload, Close.
* **Editor** — type, move the cursor, scroll, `Ctrl+S` to save.
* **Console** — the last lines your scripts logged.
* **Buttons** — Run, Stop, Save, Reload.

The IDE only touches the server thread through the normal scheduled-task queue, so saving a
file cannot corrupt the world.

## 8. Configuration

`config/scriptcraft.properties`:

| Key | Default | Meaning |
| --- | --- | --- |
| `sandbox.enabled` | `true` | Java interop off, scripting globals removed, scoped SecurityManager |
| `log.toFile` | `true` | Also write script output to `logs/scriptcraft-*.log` |
| `scripts.copyExamples` | `true` | Copy the bundled examples on first run |
| `scripts.autoLoadOnServerStart` | `false` | Run every script when the server starts |
| `command.permissionLevel` | `2` | Op level needed for `/script` |
| `timer.maxPerScript` | `200` | Timers one script may have at once |
| `timer.maxCallbacksPerTick` | `64` | Timer callbacks per tick, the rest wait |
| `timer.maxMillisPerTick` | `8` | Timer time budget per tick |
| `tick.maxHandlersPerTick` | `256` | Event listeners per tick |
| `tick.maxMillisPerTick` | `8` | Event time budget per tick |

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Script engine unavailable` in the log | You are not on Java 8 — Nashorn is not there |
| `/script` says nothing happens | You need op level 2, or run it from an integrated server |
| `Script not found` | The file is not in `scripts/`, or the name has no `.js` |
| `Not a JavaScript file` | The name must end in `.js` |
| `Path escapes the scripts directory` | `..` or an absolute path in the file name |
| Nothing happens after an edit | Use `/script reload <file>` — running files are read once |
| Chat listener does not fire | Chat events only fire on a server (single player counts) |
| Script error mentions `Java.type` | Java access is off by design; use the provided API |
