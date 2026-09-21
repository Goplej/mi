package com.scriptcraft.security;

import jdk.nashorn.api.scripting.NashornScriptEngineFactory;

import javax.script.ScriptEngine;

/**
 * Creates Nashorn engines with Java interop switched off ({@code --no-java}).
 *
 * <p>With that option Nashorn does not define the {@code Java}, {@code Packages} and {@code java}
 * globals, so a script cannot reach {@code Runtime}, {@code ProcessBuilder} or the file system.
 * It is kept in its own class so that {@link ScriptSandbox} can catch a missing Nashorn without
 * dragging an unresolvable class into the rest of the mod.
 */
public final class NashornEngines {

    private NashornEngines() {
    }

    public static ScriptEngine create() {
        return new NashornScriptEngineFactory().getScriptEngine("--no-java");
    }

    public static String description(ScriptEngine engine) {
        return engine.getFactory().getEngineName() + " " + engine.getFactory().getEngineVersion();
    }
}
