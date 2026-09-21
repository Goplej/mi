# Events

Register a listener and the function is called whenever the game fires the matching event.
Listeners belong to the script that registered them: `/script stop <file>` removes exactly
those, and `/script reload <file>` removes the old ones before the new file runs, so a listener
is never called twice.

```js
events.onPlayerJoin(function (event) {
    event.player.sendMessage("Welcome, " + event.player.getName() + "!");
});
```

## The events

| Function | Fires | Cancelable |
| --- | --- | --- |
| `events.onPlayerJoin(fn)` | A player finishes logging in | no |
| `events.onPlayerQuit(fn)` | A player disconnects | no |
| `events.onPlayerChat(fn)` | A chat message is sent | yes, and the text can be rewritten |
| `events.onPlayerBreakBlock(fn)` | A player breaks a block | yes |
| `events.onPlayerPlaceBlock(fn)` | A block is placed | yes |
| `events.onPlayerDeath(fn)` | Any living entity dies | yes (stops the death) |
| `events.onEntitySpawn(fn)` | An entity joins the world | yes (prevents the spawn) |
| `events.onTick(fn)` | Every server tick, once, at the end of the tick | no |

Plus `events.listenerCount()` and `events.clear()` (drops this script's own listeners).

## The event object

One object is created per event and passed to every listener. Which parts are filled in depends
on the event:

| Method | Present on | Notes |
| --- | --- | --- |
| `getType()` | all | The event name, e.g. `"onPlayerChat"` |
| `getPlayer()` | join, quit, chat, break, place, death of a player | A `PlayerApi` |
| `setPlayer(player)` | same | |
| `getEntity()` | death, entity spawn | An `EntityApi` |
| `setEntity(entity)` | same | |
| `getMessage()` | chat | The message text |
| `setMessage(text)` | chat | Rewrite what is broadcast |
| `getBlock()` | break, place | `"minecraft:stone"` |
| `setBlock(name)` | break, place | |
| `getBlockMeta()` | break, place | number |
| `setBlockMeta(value)` | break, place | |
| `getX()` / `getY()` / `getZ()` | break, place, entity spawn | `hasPosition()` tells you when they are set |
| `setPosition(x, y, z)` | same | |
| `getTick()` | all | Server tick |
| `cancel()` | cancelable events | |
| `isCanceled()` | all | |

## Cancelling

```js
// No obsidian mining without a reason
events.onPlayerBreakBlock(function (event) {
    if (event.getBlock() === "minecraft:obsidian") {
        event.cancel();
        event.getPlayer().sendMessage("Not this block.");
    }
});
```

`cancel()` is honoured for chat, block break, block place, death and entity spawn — the Forge
event is cancelled for real, so the block is not broken and the entity never enters the world.
Calling it on a non-cancelable event does nothing.

## Rewriting chat

```js
events.onPlayerChat(function (event) {
    event.setMessage(event.getMessage().toUpperCase());
});
```

## Notes that are easy to trip over

* **`onPlayerDeath` fires for every living entity**, players included. `getPlayer()` is only
  filled in when the one that died was a player:

  ```js
  events.onPlayerDeath(function (event) {
      var player = event.getPlayer();
      if (player !== null && player !== undefined) {
          console.log(player.getName() + " died to " + event.getCause());
      }
  });
  ```

* **Client-side events are ignored.** Anything with `world.isRemote == true` is skipped, so a
  listener never runs twice in single player.
* **Chat events need a server.** They do not fire on a purely client-side screen.
* **`onTick` is per server tick** (20 per second), dispatched once at the end of the tick. Keep
  it cheap; the budget below applies.
* **Listeners of stopped scripts are skipped** even in the middle of a dispatch.

## Limits

One event dispatch is bounded by both a handler count and wall clock time:

| Config key | Default | Meaning |
| --- | --- | --- |
| `tick.maxHandlersPerTick` | `256` | Listeners called for one event |
| `tick.maxMillisPerTick` | `8` | Milliseconds one event dispatch may take |

When a budget runs out the remaining listeners are skipped for that event and a warning is
logged at most once every 10 seconds. A listener that throws is logged with file and line, and
the other listeners still run:

```
[ScriptCraft/ERROR] Listener onTick in bad.js failed
Script error
File: bad.js
Line: 1
Error: ReferenceError: "nope" is not defined in bad.js at line number 1
```

## From Forge to JavaScript

`EventBridge` is the only class that knows about Forge events. Each `@SubscribeEvent` handler
builds a `ScriptEventObject` and hands it to `ScriptEventRegistry`, which holds the listeners
per script context. Adding a new event means: add a name to `ScriptEventType`, add a handler to
`EventBridge`, add one method to `EventsApi`. Nothing else changes.
