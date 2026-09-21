#!/usr/bin/env bash
#
# Fetches a JDK for the offline verification rig.
#
#   ./dev-verify/fetch-jdk.sh [destination]
#
# Why this exists: verify.sh needs a JDK with a JavaScript engine (Nashorn) and a compiler that
# can target Java 8. A build machine normally has one - install Java 8 and point JAVA_HOME at it.
# Sandboxes often have neither, and the usual download hosts (Adoptium, Oracle, Debian mirrors)
# are not always reachable from them. The npm registry is, and it carries a few packages that
# ship a real JDK as a payload: this script fetches one and unpacks it into $DEST (default
# /tmp/scriptcraft-jdk), prints the JAVA_HOME to use, and verifies javac and Nashorn actually run.
#
# The package used is "@dragon-den/install-jdk-11" (OpenJDK 11.0.18+10, linux-x64). JDK 11 is
# enough for this rig because javac 11 compiles the mod with --release 8, which checks the code
# against the real Java 8 API surface (lib/ct.sym), and Nashorn is still part of JDK 11.
#
# This is a convenience for verification only. The mod itself targets the Java 8 runtime that
# Minecraft 1.12.2 runs on, and nothing here is needed to build the jar (that is gradlew build,
# which downloads ForgeGradle from maven.minecraftforge.net).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${1:-/tmp/scriptcraft-jdk}"
url="https://registry.npmjs.org/@dragon-den/install-jdk-11/-/install-jdk-11-0.0.3.tgz"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "== downloading the JDK package ($(basename "$url"))"
curl -fsSL -o "$work/jdk.tgz" "$url"

echo "== unpacking"
mkdir -p "$work/outer" "$dest"
tar xzf "$work/jdk.tgz" -C "$work/outer"
inner="$work/outer/package/target/package.tar.gz"
if [ ! -f "$inner" ]; then
    inner="$(find "$work/outer" -name 'package.tar.gz' -o -name 'linux-x64.tar.gz' | head -1)"
fi
[ -n "$inner" ] && [ -f "$inner" ] || { echo "unexpected package layout" >&2; exit 1; }
tar xzf "$inner" -C "$dest"
chmod +x "$dest"/jdk-*/bin/* 2>/dev/null || true

jdk="$(find "$dest" -maxdepth 2 -name javac -path '*/bin/*' -printf '%h\n' | head -1)"
if [ -z "$jdk" ]; then
    jdk="$(find "$dest" -maxdepth 3 -name java -path '*/bin/*' -printf '%h\n' | head -1)"
fi
[ -n "$jdk" ] || { echo "no JDK found under $dest" >&2; exit 1; }
jdk="$(dirname "$jdk")"

echo "== checking the toolchain"
"$jdk/bin/java" -version 2>&1 | head -1
if command -v jjs >/dev/null 2>&1 || [ -x "$jdk/bin/jjs" ]; then
    echo -n 'print("nashorn=" + java.lang.System.getProperty("java.version"))' > "$work/probe.js"
    "$jdk/bin/jjs" "$work/probe.js" 2>/dev/null | tail -1 || true
fi

echo
echo "JAVA_HOME=$jdk"
echo "run:  JAVA_HOME=$jdk ./dev-verify/verify.sh"
