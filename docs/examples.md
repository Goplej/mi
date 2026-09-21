# Examples

Everything on this page is copied into `scripts/` on first run (the first six) or is a recipe
you can paste into a new file with `/script new <name>.js`.

---

## example.js — the smallest script there is

```js
console.log("Hello from example.js");
player.sendMessage("ScriptCraft loaded successfully!");
```

```
/script run example.js
```

## welcome.js — greet players

```js
events.onPlayerJoin(function (event) {
    event.player.sendMessage("Welcome, " + event.player.getName() + "!");
    console.log(event.player.getName() + " joined the game");
});

events.onPlayerQuit(function (event) {
    console.log(event.player.getName() + " left the game");
});
```

## events.js — chat filter and block reports

```js
events.onPlayerChat(function (event) {
    if (event.getMessage().indexOf("spam") >= 0) {
        event.cancel();
        event.getPlayer().sendMessage("No spam here.");
    }
});

events.onPlayerBreakBlock(function (event) {
    console.log(event.getPlayer().getName() + " broke " + event.getBlock()
        + " at " + event.getX() + "," + event.getY() + "," + event.getZ());
});

events.onPlayerDeath(function (event) {
    console.log("Something died: " + event.getEntity().getType()
        + " (cause: " + event.getCause() + ")");
});
```

## timer.js — one-shot and repeating

```js
timer.after(500, function () {
    console.log("Half a second has passed");
});

var runs = 0;
var id = timer.every(1000, function () {
    runs++;
    player.sendActionBar("ScriptCraft timer: " + runs + "/5");
    if (runs >= 5) {
        timer.cancel(id);
        console.log("Timer finished after " + runs + " runs");
    }
});

console.log("Timers scheduled: " + timer.active());
```

## blocks.js — read and write blocks

```js
var x = player.getBlockX();
var y = player.getBlockY();
var z = player.getBlockZ();

world.setBlock(x, y - 1, z, "minecraft:stone");
world.setBlock(x + 1, y - 1, z, "minecraft:stone:1");

var under = world.getBlock(x, y - 1, z);
var next = blocks.get(x + 1, y - 1, z);

console.log("Under you: " + under.getName() + " meta " + under.getMeta());
console.log("Next to it: " + next + " (id " + blocks.idOf(next.getName()) + ")");
console.log("Air above you: " + world.isAir(x, y + 2, z));

player.sendMessage("Stone platform built at " + x + "," + (y - 1) + "," + z);
```

## test.js — self test

```
/script run test.js
```

prints one line per subsystem:

```
[ScriptCraft Test]
Engine: OK
Player API: OK
World API: OK
Events: OK
Timers: OK
Error handling: OK
```

If any line says `FAIL`, `/script info test.js` and
`scriptcraft/logs/scriptcraft-<date>.log` will tell you why.

---

# Recipes

## Countdown

```js
var left = 10;
var id = timer.every(1000, function () {
    left--;
    player.sendActionBar(left > 0 ? left + "…" : "Go!");
    if (left <= 0) {
        timer.cancel(id);
    }
});
```

## Protect an area

```js
var centerX = 0;
var centerZ = 0;
var radius = 32;

events.onPlayerBreakBlock(function (event) {
    var dx = event.getX() - centerX;
    var dz = event.getZ() - centerZ;
    if (dx * dx + dz * dz < radius * radius) {
        event.cancel();
        event.getPlayer().sendMessage("You cannot break blocks in the protected area.");
    }
});
```

## Keep everybody topped up

```js
timer.every(5000, function () {
    var players = world.getPlayers();
    for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (p.getHealth() < 6) {
            p.setHealth(p.getMaxHealth());
            p.setFoodLevel(20);
            p.sendMessage("You were almost dead — healed.");
        }
    }
});
```

## Glass ring around the player

```js
var cx = player.getBlockX();
var cy = player.getBlockY();
var cz = player.getBlockZ();
var radius = 4;

for (var x = -radius; x <= radius; x++) {
    for (var z = -radius; z <= radius; z++) {
        if (x * x + z * z <= radius * radius) {
            world.setBlock(cx + x, cy, cz + z, "minecraft:glass");
        }
    }
}
console.log("Ring built at " + cx + "," + cy + "," + cz);
```

## Player count announcement

```js
timer.every(60000, function () {
    server.broadcast("Players online: " + server.getPlayerCount());
});
```

## Kill the cows that keep spawning in your base

```js
var baseX = 0;
var baseZ = 0;

events.onEntitySpawn(function (event) {
    var entity = event.getEntity();
    var dx = entity.getX() - baseX;
    var dz = entity.getZ() - baseZ;
    if (entity.getType() === "minecraft:cow" && dx * dx + dz * dz < 900) {
        event.cancel();
    }
});
```

## Admin helpers through the server API

```js
function day() {
    server.runCommand("time set day");
    console.log("Time set to day (result " + server.getTick() + ")");
}

function healEveryone() {
    var players = server.getPlayers();
    for (var i = 0; i < players.length; i++) {
        players[i].setHealth(players[i].getMaxHealth());
    }
    server.broadcast("Everyone healed.");
}

day();
```

## Log the day's activity

```js
var log = [];

events.onPlayerBreakBlock(function (event) {
    log.push(event.getPlayer().getName() + " broke " + event.getBlock());
});

events.onPlayerDeath(function (event) {
    var player = event.getPlayer();
    if (player !== null && player !== undefined) {
        log.push(player.getName() + " died (" + event.getCause() + ")");
    }
});

timer.every(300000, function () {
    console.log("Last 5 minutes: " + (log.length === 0 ? "nothing happened" : log.join(" | ")));
    log = [];
});
```

---

## Things worth knowing while you write scripts

* **A script that registers nothing is finished as soon as it returns.** Only listeners and
  timers keep it alive.
* **Variables are per script.** Each script has its own engine, so nothing leaks between them.
* **`reload` re-reads the file.** Edit in the IDE or in your editor, then `/script reload x.js`.
* **No Java access.** `Java.type`, `require`, `importClass` and friends are gone on purpose.
  Everything is available through `player`, `world`, `blocks`, `entities`, `server`, `events`,
  `timer` and `console`.
* **Numbers are numbers.** `getX()` returns a double; `getBlockX()` returns the floored int —
  use the block one for `setBlock`.
