package com.scriptcraft.security;

import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.core.ScriptCraftLog;

import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.security.Permission;
import java.util.concurrent.Callable;

/**
 * Builds the engines scripts run in and limits what a script can do while it runs.
 *
 * <p>Three independent layers:
 * <ol>
 *   <li><b>No Java interop.</b> Engines are created with {@code --no-java}, which removes
 *       {@code Java.type}, {@code Packages} and the {@code java} global. Scripts only see the
 *       ScriptCraft API objects, and {@code java.lang.Class} instances handed to them are
 *       sanitised by Nashorn (no {@code forName}, no {@code getClassLoader}).</li>
 *   <li><b>Dangerous globals removed.</b> {@code load}, {@code read}, {@code exit}, {@code quit}
 *       and the default {@code engine} binding are deleted from every new engine.</li>
 *   <li><b>Scoped SecurityManager.</b> While a script executes, process execution, JVM shutdown,
 *       replacing the SecurityManager and loading native libraries are denied. Outside of script
 *       execution the manager allows everything, so Minecraft itself is never affected.</li>
 * </ol>
 *
 * <p>Nashorn is not a hard security boundary: treat {@code .minecraft/scriptcraft/scripts} as a
 * folder for trusted scripts. The layers above stop accidents and casual abuse, not a determined
 * attacker.
 */
public final class ScriptSandbox {

    private static final ThreadLocal<int[]> GUARD_DEPTH = new ThreadLocal<int[]>() {
        @Override
        protected int[] initialValue() {
            return new int[]{0};
        }
    };

    private static boolean managerInstalled;
    private static boolean available = true;

    private ScriptSandbox() {
    }

    /** Creates an engine for one script. Never returns an engine with Java interop enabled. */
    public static ScriptEngine createEngine() {
        ScriptEngine engine = null;
        try {
            engine = NashornEngines.create();
        } catch (Throwable t) {
            ScriptCraftLog.warn("Nashorn with --no-java unavailable (" + t + "), falling back to the default JavaScript engine");
            engine = new ScriptEngineManager().getEngineByName("nashorn");
        }
        if (engine == null) {
            throw new IllegalStateException("No JavaScript engine found. Minecraft 1.12.2 needs Java 8, which ships Nashorn.");
        }
        harden(engine);
        return engine;
    }

    private static void harden(ScriptEngine engine) {
        // Nashorn hands every script the ScriptEngine itself ("engine") plus file and VM helpers.
        // They are engine built-ins rather than scope entries, so `delete` silently fails and
        // removing them from ENGINE_SCOPE does nothing either. Shadowing each one with a top-level
        // `var` does work, and the shadow stays in place for every later eval in this engine.
        try {
            engine.eval(
                  "var engine = undefined, load = undefined, loadWithNewGlobal = undefined, "
                + "read = undefined, readbuffer = undefined, readline = undefined, "
                + "writeFile = undefined, appendFile = undefined, "
                + "exit = undefined, quit = undefined, "
                + "print = undefined, echo = undefined, $ARG = undefined, $ENV = undefined;");
        } catch (ScriptException e) {
            ScriptCraftLog.warn("Could not strip the scripting globals: " + e.getMessage());
        }
        // With --no-java these do not exist, but if the engine had to be created without that flag
        // (see createEngine) shadowing them is what keeps Java interop out of the scripts.
        try {
            engine.eval(
                  "var Java = undefined, Packages = undefined, JavaImporter = undefined, "
                + "java = undefined, javax = undefined, com = undefined, org = undefined, "
                + "net = undefined, edu = undefined;");
        } catch (ScriptException e) {
            ScriptCraftLog.warn("Could not shadow the Java interop globals: " + e.getMessage());
        }
    }

    /** Installs the scoped SecurityManager. Safe to call more than once. */
    public static void install() {
        if (!ScriptCraftConfig.sandboxEnabled) {
            ScriptCraftLog.warn("Sandbox disabled by configuration (sandbox.enabled=false)");
            return;
        }
        if (managerInstalled) {
            return;
        }
        if (System.getSecurityManager() != null) {
            ScriptCraftLog.warn("Another SecurityManager is already installed; ScriptCraft sandbox restrictions are inactive");
            return;
        }
        try {
            System.setSecurityManager(new ScriptCraftSecurityManager());
            managerInstalled = true;
            ScriptCraftLog.info("Sandbox active (no Java interop, no process execution, no JVM shutdown from scripts)");
        } catch (Throwable t) {
            ScriptCraftLog.warn("Could not install the sandbox SecurityManager: " + t);
        }
    }

    public static boolean isManagerInstalled() {
        return managerInstalled;
    }

    public static boolean isNashornAvailable() {
        return available;
    }

    /** Runs {@code task} with the script restrictions enabled on the current thread. */
    public static <T> T guard(Callable<T> task) throws Exception {
        int[] depth = GUARD_DEPTH.get();
        depth[0]++;
        try {
            return task.call();
        } finally {
            depth[0]--;
        }
    }

    public static void guardRun(Runnable task) {
        int[] depth = GUARD_DEPTH.get();
        depth[0]++;
        try {
            task.run();
        } finally {
            depth[0]--;
        }
    }

    static boolean isGuarded() {
        return GUARD_DEPTH.get()[0] > 0;
    }

    /** Evaluates script source inside the sandbox. */
    public static Object eval(ScriptEngine engine, String source, String fileName) throws Exception {
        engine.put(ScriptEngine.FILENAME, fileName);
        return guard(new Callable<Object>() {
            @Override
            public Object call() throws Exception {
                return engine.eval(source);
            }
        });
    }

    /** Calls a JavaScript function inside the sandbox. */
    public static Object invoke(ScriptEngine engine, Object function, Object... args) throws Exception {
        if (!(engine instanceof Invocable)) {
            throw new ScriptException("Script engine cannot call functions");
        }
        final Object[] callArgs = new Object[args.length + 1];
        callArgs[0] = null; // thisArg
        System.arraycopy(args, 0, callArgs, 1, args.length);
        return guard(new Callable<Object>() {
            @Override
            public Object call() throws Exception {
                return ((Invocable) engine).invokeMethod(function, "call", callArgs);
            }
        });
    }

    /**
     * Denies the operations that would let a script damage the machine or the game.
     * Everything else is allowed, including outside of script execution.
     */
    private static final class ScriptCraftSecurityManager extends SecurityManager {

        @Override
        public void checkPermission(Permission permission) {
            if (!isGuarded() || permission == null) {
                return;
            }
            String name = String.valueOf(permission.getName());
            String actions = permission.getActions();

            if (permission instanceof java.io.FilePermission && actions != null && actions.contains("execute")) {
                deny("running external programs", name);
            }
            if (name.startsWith("exitVM")) {
                deny("stopping the JVM", name);
            }
            if ("setSecurityManager".equals(name)) {
                deny("replacing the SecurityManager", name);
            }
            if (name.startsWith("loadLibrary.")) {
                deny("loading native libraries", name);
            }
        }

        @Override
        public void checkPermission(Permission permission, Object context) {
            checkPermission(permission);
        }

        private void deny(String what, String detail) {
            throw new SecurityException("[ScriptCraft] sandbox denied " + what + " (" + detail + ")");
        }
    }

    /** Only used by the diagnostics command; keeps {@code available} meaningful. */
    static void markUnavailable() {
        available = false;
    }
}
