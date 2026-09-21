# API reference

Every script starts with these bindings already in scope. They belong to that script's
context: when the script is stopped or reloaded, its listeners and timers go away, but the API
itself is recreated from scratch for the next run.

| Binding | Type | Available |
| --- | --- | --- |
| `player` | `PlayerApi` | The player who ran the script (`/script run` must be typed in game for this). Started from the server console it exists but `isValid()` is `false`, getters return safe defaults, and calls that would change something — `sendMessage`, `sendActionBar`, `teleport`, `setHealth`, `setFoodLevel` — are reported in the log as ignored instead of doing nothing quietly. |
| `world` | `WorldApi` | The world of the owner, or the overworld when run from the console |
| `blocks` | `BlocksApi` | Shortcuts for block reads/writes in `world` |
| `entities` | `EntitiesApi` | Entities in `world` |
| `server` | `ServerApi` | The running server (client and dedicated) |
| `events` | `EventsApi` | Event listeners, bound to this script |
| `timer` | `TimerApi` | Timers, owned by this script |
| `console` | `ConsoleApi` | Logging |
| `scriptcraft` | `InfoApi` | Mod information |

Lists returned by the API (`getPlayers()`, `getEntities()`, `getNearby()`, `listScripts()`,
`nearbyTypes()`) are Java lists. In a script they support `.length`, `.size()`, `[i]` and
`.get(i)`, but they are not real JavaScript arrays, so `forEach`/`map`/`filter` do not exist on
them:

```js
var players = world.getPlayers();
for (var i = 0; i < players.length; i++) {
    console.log(players[i].getName());
}

// ...unless you copy them first:
var names = [];
for (var j = 0; j < players.length; j++) {
    names.push(players[j].getName());
}
names.sort();
console.log(names.join(", "));
```

---

## player

| Method | Returns | Notes |
| --- | --- | --- |
| `isValid()` | boolean | `false` when no player started the script |
| `getName()` | string | |
| `sendMessage(text)` | | Chat message |
| `sendActionBar(text)` | | Action bar |
| `getX()` / `getY()` / `getZ()` | number | Exact position |
| `getBlockX()` / `getBlockY()` / `getBlockZ()` | number | Floored block position |
| `getHealth()` / `getMaxHealth()` | number | |
| `setHealth(value)` | | Clamped to `0 .. maxHealth` |
| `getFoodLevel()` / `setFoodLevel(value)` | number | |
| `isSneaking()` / `isSprinting()` / `isOnGround()` / `isInWater()` | boolean | |
| `getWorld()` | `WorldApi` | The player's current world |
| `getWorldName()` | string | |
| `getDimension()` | number | `0`, `-1`, `1`, … |
| `getHeldItem()` | `ItemApi` | Main hand |
| `teleport(x, y, z)` | | |
| `giveItem(name, count)` | boolean | `giveItem("minecraft:diamond", 5)` |
| `kick(reason)` | | Server only |

```js
if (player.getHealth() < 6) {
    player.setHealth(player.getMaxHealth());
    player.sendMessage("Healed");
}
player.teleport(player.getX(), player.getY() + 10, player.getZ());
```

## world

Resolved on every call, so it follows the player across dimensions.

| Method | Returns | Notes |
| --- | --- | --- |
| `isAvailable()` / `isClient()` | boolean | |
| `getName()` | string | |
| `getDimension()` | number | |
| `getTime()` / `setTime(value)` | number | World time in ticks |
| `getMaxHeight()` | number | Usually 256 |
| `getBlock(x, y, z)` | `BlockInfo` | |
| `setBlock(x, y, z, name)` | boolean | |
| `setBlock(x, y, z, name, meta)` | boolean | |
| `isAir(x, y, z)` | boolean | |
| `getBlockId(x, y, z)` | number | |
| `getPlayers()` | list of `PlayerApi` | |
| `getEntities()` | list of `EntityApi` | Every loaded entity — can be big |
| `getEntitiesNear(x, y, z, radius)` | list of `EntityApi` | Prefer this |

Coordinates outside the world bounds are rejected (`setBlock` returns `false`) instead of
throwing.

### Block names

`"stone"`, `"minecraft:stone"`, `"minecraft:stone:1"`, `"log:2"` and numeric ids such as `1`
all work. Unknown names raise an `IllegalArgumentException`, which shows up as a normal script
error with the line number.

## blocks

| Method | Returns | Notes |
| --- | --- | --- |
| `get(x, y, z)` | `BlockInfo` | |
| `set(x, y, z, name[, meta])` | boolean | |
| `nameAt(x, y, z)` | string | `"minecraft:stone"` |
| `idOf(name)` | number | `-1` when unknown |
| `exists(name)` | boolean | |
| `isAir(x, y, z)` | boolean | |

### BlockInfo

`getName()`, `getMeta()`, `getX()`, `getY()`, `getZ()`, `isAir()`, and a readable `toString()`
such as `minecraft:stone:0 @ 10,20,30`.

## entities

| Method | Returns | Notes |
| --- | --- | --- |
| `getNearby(x, y, z, radius)` | list of `EntityApi` | |
| `count()` | number | Loaded entities in the world |
| `spawn(name, x, y, z)` | `EntityApi` | `spawn("minecraft:cow", 0, 64, 0)`; `null` for an unknown id |
| `nearbyTypes(x, y, z, radius)` | list of string | |

### EntityApi

`getName()`, `getType()`, `getId()`, `getX/getY/getZ()`, `getHealth()`, `isAlive()`,
`isValid()`, `getDimension()`, `teleport(x, y, z)`, `remove()`.

## server

| Method | Returns | Notes |
| --- | --- | --- |
| `isAvailable()` / `isClient()` / `isDedicated()` | boolean | |
| `getName()` | string | |
| `getPlayerCount()` | number | |
| `getPlayers()` | list of `PlayerApi` | |
| `getPlayer(name)` | `PlayerApi` | `null` when offline |
| `broadcast(text)` | | Message to everybody |
| `runCommand(command)` | number | Result code; the leading `/` is optional |
| `getTick()` | number | Server tick counter |

## events

Every registration returns nothing and is owned by the script that made it. See
[events.md](events.md) for the event objects.

`onPlayerJoin(fn)` · `onPlayerQuit(fn)` · `onPlayerChat(fn)` · `onPlayerBreakBlock(fn)` ·
`onPlayerPlaceBlock(fn)` · `onPlayerDeath(fn)` · `onEntitySpawn(fn)` · `onTick(fn)` ·
`listenerCount()` · `clear()`

## timer

`after(ms, fn)` · `every(ms, fn)` · `cancel(id)` · `active()` — see [timers.md](timers.md).

## console

| Method | Notes |
| --- | --- |
| `log(...)` | Info level |
| `info(...)` | Info level |
| `warn(...)` | Warn level |
| `error(...)` | Error level |

Arguments are joined with spaces; objects are stringified. Output goes to the Forge log and to
`scriptcraft/logs/`, prefixed so you can tell scripts apart:

```
[ScriptCraft] [ScriptCraft:example.js] Hello from example.js
```

## scriptcraft

| Method | Returns |
| --- | --- |
| `getVersion()` | `"0.1.0"` |
| `getMcVersion()` | `"1.12.2"` |
| `getScript()` | the file name of the running script |
| `getScriptsDir()` | absolute path of the scripts folder |
| `listScripts()` | list of file names |
| `isClient()` / `isDedicatedServer()` | boolean |

## What is deliberately missing

`Java.type`, `Packages`, `java.*`, `Class.forName`, `engine`, `load`, `read`, `exit`, `quit`.
There is no way to reach the JVM from a script; everything you need is in the API above.

## Adding your own API

Add a class in `com.scriptcraft.api`, then expose it in
`ScriptBindings.install(context, owner, registry, timers)`:

```java
engine.put("myapi", new MyApi(context, owner));
```

Nothing else changes: the object is bound per script, cleared on `stop`, and re-created on
`reload`, exactly like the built-ins.
