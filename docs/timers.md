# Timers

```js
timer.after(500, function () {
    player.sendMessage("Half a second later");
});

var id = timer.every(1000, function (tick) {
    player.sendActionBar("Every second, tick " + tick);
});

timer.cancel(id);
```

| Function | Returns | Notes |
| --- | --- | --- |
| `timer.after(ms, fn)` | timer id (`-1` if the limit was hit) | Fires once |
| `timer.every(ms, fn)` | timer id (`-1` if the limit was hit) | Fires until cancelled |
| `timer.cancel(id)` | boolean | `false` if that id no longer exists |
| `timer.active()` | number | Timers this script currently owns |

The callback receives the current server tick as its first argument.

## Timers belong to their script

Each timer is recorded in the script context that created it, which is what makes
`/script stop` clean:

```
/script stop countdown.js
Stopped countdown.js (timers cancelled: 2, listeners removed: 0)
```

Stopping, reloading, an unloaded script and server shutdown all cancel its timers, and a timer
whose script has been stopped is dropped instead of fired.

## Milliseconds become ticks

Minecraft runs 20 ticks per second, so 1 tick = 50 ms. Delays are converted with
`round(ms / 50)` and a minimum of 1 tick:

| You write | Actually waits |
| --- | --- |
| `timer.after(1, …)` | 1 tick (50 ms) |
| `timer.after(150, …)` | 3 ticks |
| `timer.every(1000, …)` | every 20 ticks |
| `timer.every(10, …)` | every tick |

Because the next run of a repeating timer is measured from when it actually fires, a callback
that takes longer than the interval delays the next one instead of piling up.

## Limits

| Config key | Default | Meaning |
| --- | --- | --- |
| `timer.maxPerScript` | `200` | Timers one script may own; over that, `after`/`every` return `-1` and a warning is logged |
| `timer.maxCallbacksPerTick` | `64` | Callbacks fired in one tick |
| `timer.maxMillisPerTick` | `8` | Milliseconds of callback time per tick |

Timers that do not fit in the tick budget are **not** dropped — they are pushed to the next
tick. That keeps a slow script from losing events, and it keeps the server from stalling.

## Errors are contained

A callback that throws is logged with the file and line, and the game carries on:

```
Script error
File: countdown.js
Line: 4
Error: ReferenceError: "tickCount" is not defined in countdown.js at line number 4
```

If the failing timer was a repeating one it is cancelled after the first failure, so a broken
`timer.every` cannot spam the log forever:

```
[ScriptCraft/WARN] [countdown.js] timer 3 cancelled after the error above
```

Fix the script and `/script reload countdown.js`.

## Driving the clock

`EventBridge.onServerTick` calls `TimerScheduler.tick()` once per server tick, then dispatches
`events.onTick`. So timers and tick listeners share the same heartbeat and run on the server
thread — you can call the world and player API from inside them without worrying about threads.

## Patterns

**Countdown**

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

**Wait for a condition, with a timeout**

```js
var started = 0;
var poll = timer.every(250, function () {
    started++;
    if (player.getHealth() >= player.getMaxHealth()) {
        timer.cancel(poll);
        console.log("Full health");
    } else if (started > 40) {
        timer.cancel(poll);
        console.log("Gave up after 10 seconds");
    }
});
```

**Self-cleaning**

```js
var keepAlive = timer.every(60000, function () {
    if (world.getPlayers().length === 0) {
        timer.cancel(keepAlive);   // nothing left to do
    }
});
```
