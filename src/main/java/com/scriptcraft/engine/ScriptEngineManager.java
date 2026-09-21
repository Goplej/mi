package com.scriptcraft.engine;

import com.scriptcraft.api.ScriptBindings;
import com.scriptcraft.core.ScriptCraftLog;
import com.scriptcraft.events.ScriptEventRegistry;
import com.scriptcraft.filesystem.ScriptFileManager;
import com.scriptcraft.security.NashornEngines;
import com.scriptcraft.security.ScriptSandbox;

import javax.script.ScriptEngine;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owns the script lifecycle: create engine, load file, execute, stop, reload.
 *
 * <p>This class knows nothing about Forge events or Minecraft - it only talks to
 * {@link ScriptFileManager} for files, {@link ScriptSandbox} for engines and
 * {@link ScriptEventRegistry}/{@link TimerScheduler} to release what a script registered.
 */
public final class ScriptEngineManager {

    private final TimerScheduler timers;
    private final ScriptEventRegistry events;
    private final Map<String, ScriptContext> contexts = new LinkedHashMap<String, ScriptContext>();

    private String engineDescription = "unknown";

    public ScriptEngineManager(TimerScheduler timers, ScriptEventRegistry events) {
        this.timers = timers;
        this.events = events;
    }

    public synchronized ScriptResult run(String fileName, Object owner) {
        String name = normalize(fileName);
        ScriptContext previous = contexts.get(name);
        if (previous != null && previous.getState() == ScriptState.RUNNING) {
            return ScriptResult.fail(name + " is already running. Use /script reload " + name);
        }
        if (previous != null) {
            teardown(previous, true);
            contexts.remove(name);
        }

        File file;
        try {
            file = ScriptFileManager.resolve(name);
        } catch (IOException e) {
            return ScriptResult.fail(e.getMessage());
        }
        if (!file.isFile()) {
            return ScriptResult.fail("Script not found: " + name);
        }

        String source;
        try {
            source = ScriptFileManager.read(name);
        } catch (IOException e) {
            return ScriptResult.fail("Could not read " + name + ": " + e.getMessage());
        }

        ScriptEngine engine;
        try {
            engine = ScriptSandbox.createEngine();
            engineDescription = NashornEngines.description(engine);
        } catch (Throwable t) {
            ScriptCraftLog.error("Script engine could not be created", t);
            return ScriptResult.fail("Script engine unavailable: " + t);
        }

        ScriptContext context = new ScriptContext(name, file, engine);
        context.setOwner(owner);
        ScriptBindings.install(context, owner, events, timers);
        contexts.put(name, context);
        context.setState(ScriptState.RUNNING);
        ScriptCraftLog.info("Running " + name);

        try {
            ScriptSandbox.eval(engine, source, name);
            return ScriptResult.ok(name + " started");
        } catch (Throwable t) {
            ScriptError error = ScriptError.of(name, t);
            context.setState(ScriptState.ERROR);
            context.setLastError(error);
            ScriptCraftLog.error("Script execution failed\n" + error.format());
            teardown(context, false);
            return ScriptResult.fail(error);
        }
    }

    public synchronized ScriptResult stop(String fileName) {
        String name = normalize(fileName);
        ScriptContext context = contexts.remove(name);
        if (context == null) {
            return ScriptResult.fail("Script is not loaded: " + name);
        }
        int[] released = teardown(context, true);
        String message = "Stopped " + name + " (timers cancelled: " + released[0] + ", listeners removed: " + released[1] + ")";
        ScriptCraftLog.info(message);
        return ScriptResult.ok(message);
    }

    public synchronized ScriptResult reload(String fileName, Object owner) {
        String name = normalize(fileName);
        stop(name); // not an error when the script was not loaded yet
        return run(name, owner);
    }

    public synchronized int stopAll() {
        int count = contexts.size();
        for (ScriptContext context : new ArrayList<ScriptContext>(contexts.values())) {
            teardown(context, true);
        }
        contexts.clear();
        if (count > 0) {
            ScriptCraftLog.info("Stopped " + count + " script(s)");
        }
        return count;
    }

    public synchronized List<ScriptContext> list() {
        List<ScriptContext> result = new ArrayList<ScriptContext>(contexts.values());
        Collections.sort(result, new Comparator<ScriptContext>() {
            @Override
            public int compare(ScriptContext a, ScriptContext b) {
                return a.getName().compareToIgnoreCase(b.getName());
            }
        });
        return result;
    }

    public synchronized ScriptContext get(String fileName) {
        return contexts.get(normalize(fileName));
    }

    public synchronized boolean isLoaded(String fileName) {
        return contexts.containsKey(normalize(fileName));
    }

    public synchronized boolean isRunning(String fileName) {
        ScriptContext context = get(fileName);
        return context != null && context.getState() == ScriptState.RUNNING;
    }

    public String getEngineDescription() {
        return engineDescription;
    }

    /**
     * Creates a throw-away engine and evaluates a one-line probe in it, so that a JVM without a
     * working JavaScript engine is reported at start-up instead of on the first {@code /script run}.
     *
     * @return the engine name, or null when the probe failed
     */
    public String probeEngine() {
        ScriptEngine probe = null;
        try {
            probe = ScriptSandbox.createEngine();
            engineDescription = NashornEngines.description(probe);
            Object result = ScriptSandbox.eval(probe, "1 + 1", "startup-probe");
            String text = String.valueOf(result);
            if (!"2".equals(text) && !"2.0".equals(text)) {
                ScriptCraftLog.warn("The JavaScript engine returned an unexpected probe result: " + result);
            }
            return engineDescription;
        } catch (Throwable t) {
            ScriptCraftLog.error("No usable JavaScript engine - scripts will not run", t);
            return null;
        } finally {
            if (probe != null) {
                probe.getBindings(javax.script.ScriptContext.ENGINE_SCOPE).clear();
            }
        }
    }

    public TimerScheduler getTimers() {
        return timers;
    }

    /**
     * Cancels timers, removes listeners and clears the engine bindings of one context.
     *
     * @param stopped true to also reset the state to STOPPED (used by /script stop); false keeps
     *                the ERROR state so /script info can still report what went wrong
     */
    private int[] teardown(ScriptContext context, boolean stopped) {
        int timerCount = timers.cancelFor(context);
        int listenerCount = events.unregisterAll(context);
        if (stopped) {
            context.dispose();
        } else {
            context.releaseResources();
        }
        return new int[]{timerCount, listenerCount};
    }

    private static String normalize(String fileName) {
        if (fileName == null) {
            return "";
        }
        String name = fileName.trim().replace('\\', '/');
        while (name.startsWith("./")) {
            name = name.substring(2);
        }
        return name;
    }
}
