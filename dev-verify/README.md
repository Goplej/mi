# dev-verify

Local, offline verification for ScriptCraft. It exists because `gradlew build` needs the
Forge/MCP artifacts from `maven.minecraftforge.net`, which are not reachable from every
build environment. This directory gives an answer that does not depend on that network.

| Path | What it is |
| --- | --- |
| `stubs/` | Compile-time stand-ins for the Minecraft and Forge classes ScriptCraft uses. Every signature was copied from the decompiled 1.12.2 sources / Forge 1.12.x sources, but the bodies are fakes. |
| `harness/Harness.java` | Boots the real mod classes and drives them: `/script` subcommands, Forge events posted on the real bus, server ticks, timers, the sandbox, path traversal, the editor model. |
| `verify.sh` | Runs the whole thing and reports a pass/fail count. |

```
./dev-verify/verify.sh        # needs a JDK 8 (JAVA_HOME or /usr/lib/jvm/java-8-openjdk-amd64)
```

The harness runs the **real** JavaScript engine (Nashorn from the JDK 8 JRE) and the
**real** mod code, so a bug in ScriptCraft shows up here as a FAIL.

## What this proves and what it does not

* Proves: the mod compiles under Java 8 with `-Xlint:all`; script loading, running,
  stopping, reloading, error reporting, timers, event dispatch, the sandbox, the traversal
  guard and the editor model behave as designed; every bundled example runs.
* Does **not** prove: that it runs inside Minecraft. The stubs are not Minecraft, no chunk
  is ever generated, no packet is sent. In-game behaviour still has to be checked by
  running `gradlew runClient` / `runServer` and typing the commands.
* `build/scriptcraft-verify.jar` is a by-product for inspecting the resource layout. It is
  not a distributable mod jar; that one is `build/libs/ScriptCraft-0.1.0.jar`.

Nothing in this directory is compiled by Gradle: the mod's source set is `src/main/java`,
so the stubs can never end up inside the shipped jar.
