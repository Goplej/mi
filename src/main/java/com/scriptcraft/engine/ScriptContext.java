package com.scriptcraft.engine;

import javax.script.Bindings;
import javax.script.ScriptEngine;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Everything that belongs to one running script: its engine, its owner, its timers and the
 * listeners it registered. {@code /script stop} and {@code /script reload} tear exactly this
 * object down, which is why listeners and timers are tracked here and nowhere else.
 */
public final class ScriptContext {

    private final String name;
    private final File file;
    private final ScriptEngine engine;
    private final UUID id = UUID.randomUUID();
    private final List<Integer> timerIds = new ArrayList<Integer>();

    private volatile ScriptState state = ScriptState.STOPPED;
    private Object owner;
    private long startedAtMillis;
    private long tickMillis;
    private int tickOverruns;
    private ScriptError lastError;

    public ScriptContext(String name, File file, ScriptEngine engine) {
        this.name = name;
        this.file = file;
        this.engine = engine;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public File getFile() {
        return file;
    }

    public ScriptEngine getEngine() {
        return engine;
    }

    public ScriptState getState() {
        return state;
    }

    public void setState(ScriptState state) {
        this.state = state;
        if (state == ScriptState.RUNNING) {
            this.startedAtMillis = System.currentTimeMillis();
        }
    }

    /** The player that started the script, or {@code null} when started from the console. */
    public Object getOwner() {
        return owner;
    }

    public void setOwner(Object owner) {
        this.owner = owner;
    }

    public long getStartedAtMillis() {
        return startedAtMillis;
    }

    public ScriptError getLastError() {
        return lastError;
    }

    public void setLastError(ScriptError error) {
        this.lastError = error;
    }

    public void addTimer(int timerId) {
        synchronized (timerIds) {
            timerIds.add(Integer.valueOf(timerId));
        }
    }

    public void removeTimer(int timerId) {
        synchronized (timerIds) {
            timerIds.remove(Integer.valueOf(timerId));
        }
    }

    public List<Integer> getTimerIds() {
        synchronized (timerIds) {
            return new ArrayList<Integer>(timerIds);
        }
    }

    /** Milliseconds this script spent in tick handlers during the current tick. */
    public long getTickMillis() {
        return tickMillis;
    }

    public void setTickMillis(long millis) {
        this.tickMillis = millis;
    }

    public int getTickOverruns() {
        return tickOverruns;
    }

    public void addTickOverrun() {
        tickOverruns++;
    }

    /**
     * Clears the engine bindings so the script's globals, closures and captured Java objects can
     * be garbage collected. Called by stop/reload and when the server shuts down.
     */
    /** Cancels the script's timers and clears its engine bindings, keeping the state readable. */
    public void releaseResources() {
        Bindings bindings = engine.getBindings(javax.script.ScriptContext.ENGINE_SCOPE);
        if (bindings != null) {
            bindings.clear();
        }
        synchronized (timerIds) {
            timerIds.clear();
        }
    }

    /** Full release: resources plus state. Used by /script stop. */
    public void dispose() {
        releaseResources();
        state = ScriptState.STOPPED;
        owner = null;
    }
}
