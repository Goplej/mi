# dev-verify

Local, offline verification for ScriptCraft. It exists because `gradlew build` needs the
Forge/MCP artifacts from `maven.minecraftforge.net`, which are not reachable from every
build environment. This directory gives an answer that does not depend on that network.

| Path | What it is |
| --- | --- |
| `stubs/` | Compile-time stand-ins for the Minecraft and Forge classes ScriptCraft uses. Every signature was copied from the decompiled 1.12.2 sources / Forge 1.12.x sources, but the bodies are fakes. |
| `harness/Harness.java` | Boots the real mod classes and drives them: `/script` subcommands, Forge events posted on the real bus, server ticks, timers, the sandbox, path traversal, config parsing, permission levels, the console sender, the bundled examples and every ```js snippet in the docs. |
| `harness/IdeProbe.java` | Subclasses `GuiScriptIde` to expose the protected `GuiScreen` hooks, so the IDE is driven by real key presses, mouse clicks and button presses. |
| `verify.sh` | Runs the whole thing and reports a pass/fail count. |
| `fetch-jdk.sh` | Downloads a JDK for machines that have none (the npm registry carries one as a payload; the Adoptium/Oracle hosts are not always reachable). |

```
./dev-verify/verify.sh              # JDK 8 (JAVA_HOME), or a newer JDK via --release 8
./dev-verify/fetch-jdk.sh           # only if there is no JDK at all; prints the JAVA_HOME to use
```

The harness runs the **real** JavaScript engine (Nashorn) and the **real** mod code, so a bug in
ScriptCraft shows up here as a FAIL. With a JDK 8 the engine is Nashorn 1.8, exactly what
Minecraft 1.12.2 runs; with a newer JDK it is that JDK's Nashorn, which is the same API.

## What this proves and what it does not

* Proves: the mod compiles targeting Java 8 with `-Xlint:all` (`--release 8` on a newer JDK
  checks it against the real Java 8 API and refuses Java 9+ methods); script loading, running,
  stopping, reloading, error reporting, timers, event dispatch, the sandbox, the traversal
  guard, the editor model and the IDE behave as designed; every bundled example and every
  documentation snippet runs.
* Does **not** prove: that it runs inside Minecraft. The stubs are not Minecraft, no chunk
  is ever generated, no packet is sent. In-game behaviour still has to be checked by
  running `gradlew runClient` / `runServer` and typing the commands.

## How the stand-ins were checked

The stubs are the only compile-time contract, so every member ScriptCraft uses was compared
against the real sources before it was accepted:

* Forge 1.12.x (`MinecraftForge/MinecraftForge`, branch `1.12.x`): the event classes, `@Cancelable`
  annotations (a `setCanceled` on a non-cancelable event throws in Forge, so `BreakEvent`,
  `EntityPlaceEvent`, `LivingDeathEvent`, `EntityJoinWorldEvent` and `ServerChatEvent` were checked
  individually), `FMLCommonHandler`, `MinecraftForge.EVENT_BUS`, `ClientRegistry`,
  `FMLServerStartingEvent`, `FMLPreInitializationEvent`.
* Minecraft 1.12 with MCP names (`WangTingZheng/mcp940`): `Entity`, `EntityLivingBase`,
  `EntityPlayer(MP|SP)`, `World`, `Block`, `ItemStack`, `Item`, `EntityList`, `FoodStats`,
  `DamageSource`, `MinecraftServer`, `PlayerList`, `ICommandManager`, `CommandBase`,
  `ICommandSender`, the `Gui*` classes, `FontRenderer`, `KeyBinding`, `Minecraft`, `BlockPos`,
  `Vec3i`, `DimensionType`, `WorldProvider`, `NetHandlerPlayServer`, `RegistryNamespaced`.

If a signature in `stubs/` is ever wrong, `verify.sh` can pass while `gradlew build` fails - so
when a real `gradlew build` becomes possible, that run is the authority.
* `build/scriptcraft-verify.jar` is a by-product for inspecting the resource layout. It is
  not a distributable mod jar; that one is `build/libs/ScriptCraft-0.1.0.jar`.

Nothing in this directory is compiled by Gradle: the mod's source set is `src/main/java`,
so the stubs can never end up inside the shipped jar.
