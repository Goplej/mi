package com.scriptcraft.engine;

/** Lifecycle of a single script. */
public enum ScriptState {
    /** Loaded but finished (or never started). Listeners and timers are gone. */
    STOPPED,
    /** Loaded and active: listeners and timers belong to a live context. */
    RUNNING,
    /** The last execution threw. The context is kept for {@code /script info} only. */
    ERROR
}
