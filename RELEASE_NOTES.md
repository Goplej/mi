# ScriptCraft 0.1.0

JavaScript scripting for **Minecraft 1.12.2 / Forge 14.23.5.2859**.

Drop `.js` files into `.minecraft/scriptcraft/scripts`, then run them with `/script run <file>` or
from the in-game IDE (**K**). Scripts get Nashorn — the real JavaScript engine that ships with the
Java 8 runtime Minecraft 1.12.2 needs — plus an API for the player, the world, blocks, entities,
events, timers and the console.

## Install

1. Minecraft 1.12.2 with Forge 14.23.5.2859.
2. Copy `ScriptCraft-0.1.0.jar` into `.minecraft/mods/`.
3. Start the game. ScriptCraft creates `scriptcraft/{scripts,config,logs}` and writes
   `example.js`; run `/script run example.js`.

## This jar

Produced by `./gradlew build` (ForgeGradle 2.3, Gradle 4.10.3, JDK 8) on the project's
[GitHub Actions workflow](https://github.com/Goplej/mi/blob/arena/01a0c3ee-mi/.github/workflows/build.yml),
including ForgeGradle's `reobfJar` step, so the class files carry the production names Forge
uses in game. The same workflow unpacks the built jar and asserts that it really is a
reobfuscated Forge 1.12.2 mod jar (manifest, `mcmod.info` with `mcversion 1.12.2`, bundled
examples, 50+ class files, class file major version 52, an `@Mod` link into FML,
`@SideOnly(Side.CLIENT)` on the client proxy, SRG `func_*` names), and runs the offline
verification rig (`dev-verify/verify.sh`, currently `PASSED: 211 FAILED: 0`) against a real JDK 8.

## Where scripts live

Both of these work for `/script run`:

* `.minecraft/scriptcraft/` — drop `mytest.js` next to `config/` and `logs/`
* `.minecraft/scriptcraft/scripts/` — where the six bundled examples are copied, and where
  `/script new` creates files

If a name exists in both folders the `scripts/` copy runs; `/script info <file>` always prints the
file that was used. A missing file now says where the mod looked:
`Script not found: typo.js - looked in scriptcraft/scripts and scriptcraft/ (...)`.

## Started without a player

`/script run` gives the script the player who typed it. Started from the server console there is no
player, and the calls that would have changed something used to be silently ignored — the script
reported success and nothing happened. Now the console is told, and the log says which call was
dropped:

```
[ScriptCraft/WARN] [ScriptCraft:mytest.js] player.sendMessage("...") was ignored: no player - the
script was started from the server console. Start it in game (/script run mytest.js as a player)
or query player.isValid() first.
```

## Forge build number

The mod is compiled against Forge **14.23.5.2847**, not 2859: ForgeGradle 2.3 needs the
`-userdev` package and Forge no longer publishes one for the last two 1.12.2 builds (2859 and
2860 return 404 on `maven.minecraftforge.net`). `mcmod.info` declares `mcversion 1.12.2`, which
is the field Forge matches, so this jar loads on 14.23.5.2859 unchanged.

`ScriptCraft-0.1.0-sources.jar` is the ForgeGradle sources jar for the same build, not a second
mod.
