#!/usr/bin/env bash
#
# Headless verification for ScriptCraft.
#
#   ./dev-verify/verify.sh
#
# What this does:
#   1. compiles every class under dev-verify/stubs  (compile-time stand-ins for Minecraft/Forge)
#   2. compiles the whole mod (src/main/java) against them, targeting Java 8, with -Xlint:all
#   3. compiles and runs the harness, which boots the real mod classes and drives them
#   4. packs a verification jar so the resource layout can be inspected
#
# What this is NOT: it does not run Minecraft and it does not run Gradle. The stubs are
# stand-ins with the real 1.12.2 signatures, so this proves that the mod compiles against
# Java 8 and that its own logic (engine, timers, events, sandbox, commands) behaves; the
# real mod jar still comes from `gradlew build`.
#
# JDK: a JDK 8 is used when one is found, which is also the runtime Minecraft 1.12.2 uses.
# A newer JDK works too - javac 9 to 20 compiles with `--release 8`, which checks the code
# against the real Java 8 API (lib/ct.sym) and runs the harness on that JDK's Nashorn.
# dev-verify/fetch-jdk.sh downloads a JDK for machines that have none.
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
out="$here/build"

jdk="${JAVA_HOME:-}"
if [ -z "$jdk" ]; then
    for candidate in \
        /tmp/scriptcraft-jdk /tmp/jdk11/jdk-11.0.18+10 /tmp/jdkrepo/jdk/1.8.0-144 \
        /usr/lib/jvm/java-8-openjdk-amd64 /usr/lib/jvm/java-8-openjdk /usr/lib/jvm/default-java; do
        if [ -x "$candidate/bin/javac" ]; then jdk="$candidate"; break; fi
    done
fi
if [ -z "$jdk" ] || [ ! -x "$jdk/bin/javac" ]; then
    echo "No JDK found. Set JAVA_HOME, or run dev-verify/fetch-jdk.sh" >&2
    exit 1
fi
jdk="$(cd "$jdk" && pwd)"

if "$jdk/bin/javac" -version 2>&1 | grep -q "1\.8"; then
    target=( -source 8 -target 8 )
    jdk_note="javac 8"
elif "$jdk/bin/javac" --release 8 -version >/dev/null 2>&1; then
    target=( --release 8 )
    jdk_note="javac $("$jdk/bin/javac" -version 2>&1 | sed 's/javac //') with --release 8"
else
    target=( -source 8 -target 8 )
    jdk_note="javac $("$jdk/bin/javac" -version 2>&1 | sed 's/javac //') without --release 8 (API check is weaker; use a JDK 8 to 20)"
    echo "warning: this javac cannot check the Java 8 API surface; $jdk_note" >&2
fi
echo "== 0/6 toolchain: $jdk_note"
echo "              java: $("$jdk/bin/java" -version 2>&1 | head -1)"

rm -rf "$out"
mkdir -p "$out/stubs" "$out/classes" "$out/harness"

echo "== 1/6 compiling the Minecraft/Forge stand-ins"
find "$here/stubs" -name '*.java' > "$out/stubs.txt"
"$jdk/bin/javac" -nowarn -encoding UTF-8 -d "$out/stubs" "@$out/stubs.txt"

echo "== 2/6 compiling the mod ($(find "$root/src/main/java" -name '*.java' | wc -l | tr -d ' ') sources)"
find "$root/src/main/java" -name '*.java' > "$out/src.txt"
"$jdk/bin/javac" -Xlint:all -encoding UTF-8 "${target[@]}" \
    -cp "$out/stubs" -d "$out/classes" "@$out/src.txt"

echo "== 3/6 running the harness"
find "$here/harness" -name '*.java' > "$out/harness.txt"
"$jdk/bin/javac" -nowarn -encoding UTF-8 \
    -cp "$out/stubs:$out/classes" -d "$out/harness" "@$out/harness.txt"
(cd "$root" && "$jdk/bin/java" -cp "$out/stubs:$out/classes:$out/harness:src/main/resources" harness.Harness)

echo "== 4/6 client/server split"
# @SideOnly(CLIENT) classes must not be reachable from server-side code, so only
# com.scriptcraft.client may import net.minecraft.client or com.scriptcraft.client.
leaks=$(grep -rl "^import \(net\.minecraft\.client\|com\.scriptcraft\.client\)" "$root/src/main/java" \
    | grep -v "/com/scriptcraft/client/" || true)
if [ -n "$leaks" ]; then
    echo "client-only classes are imported outside com.scriptcraft.client:" >&2
    echo "$leaks" >&2
    exit 1
fi
echo "   ok  no client-only class is imported outside com.scriptcraft.client"

echo "== 5/6 mcmod.info"
# A malformed mcmod.info makes Forge log an error at load, and the placeholders have to match
# the expand map in build.gradle.
python3 - "$root" <<'PY'
import json, re, sys
root = sys.argv[1]
raw = open(root + "/src/main/resources/mcmod.info").read()
expanded = re.sub(r"\$\{mcversion\}", "1.12.2", re.sub(r"\$\{version\}", "0.1.0", raw))
data = json.loads(expanded)
assert data[0]["modid"] == "scriptcraft", data[0]["modid"]
assert data[0]["version"] == "0.1.0", data[0]["version"]
assert data[0]["mcversion"] == "1.12.2", data[0]["mcversion"]
assert "${" not in expanded, "unexpanded placeholder left in mcmod.info"
print("   ok  mcmod.info parses; modid=%s version=%s mcversion=%s"
      % (data[0]["modid"], data[0]["version"], data[0]["mcversion"]))
PY

echo "== 6/6 packing the verification jar"
cp -r "$root/src/main/resources/." "$out/classes/"
"$jdk/bin/jar" cf "$out/scriptcraft-verify.jar" -C "$out/classes" .
echo "   $(unzip -l "$out/scriptcraft-verify.jar" 2>/dev/null | tail -1 | awk '{print $2}') entries -> $out/scriptcraft-verify.jar"
echo "   (verification artifact only - the shippable mod jar is build/libs/ScriptCraft-0.1.0.jar from gradlew build)"
echo
echo "verify.sh finished."
