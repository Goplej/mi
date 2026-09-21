package com.scriptcraft.api;

import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.events.ScriptEventRegistry;
import com.scriptcraft.events.ScriptEventType;

/**
 * {@code events} - subscribe to game events.
 *
 * <pre>
 * events.onPlayerJoin(function(event) {
 *     event.player.sendMessage("Welcome!");
 * });
 * </pre>
 *
 * Listeners are registered against the owning {@link ScriptContext}, so stopping or reloading a
 * script removes exactly its listeners.
 */
public final class EventsApi {

    private final ScriptContext context;
    private final ScriptEventRegistry registry;

    public EventsApi(ScriptContext context, ScriptEventRegistry registry) {
        this.context = context;
        this.registry = registry;
    }

    public void onPlayerJoin(Object callback) {
        register(ScriptEventType.PLAYER_JOIN, callback);
    }

    public void onPlayerQuit(Object callback) {
        register(ScriptEventType.PLAYER_QUIT, callback);
    }

    /** {@code event.cancel()} drops the message, {@code event.setMessage()} rewrites it. */
    public void onPlayerChat(Object callback) {
        register(ScriptEventType.PLAYER_CHAT, callback);
    }

    public void onPlayerBreakBlock(Object callback) {
        register(ScriptEventType.PLAYER_BREAK_BLOCK, callback);
    }

    public void onPlayerPlaceBlock(Object callback) {
        register(ScriptEventType.PLAYER_PLACE_BLOCK, callback);
    }

    public void onPlayerDeath(Object callback) {
        register(ScriptEventType.PLAYER_DEATH, callback);
    }

    public void onEntitySpawn(Object callback) {
        register(ScriptEventType.ENTITY_SPAWN, callback);
    }

    /** Fires once per server tick. Keep it cheap - see docs/timers.md. */
    public void onTick(Object callback) {
        register(ScriptEventType.TICK, callback);
    }

    /** Number of listeners this script owns. */
    public int listenerCount() {
        return registry.countFor(context);
    }

    /** Removes every listener this script registered. */
    public int clear() {
        return registry.unregisterAll(context);
    }

    private void register(ScriptEventType type, Object callback) {
        if (callback == null) {
            throw new IllegalArgumentException("events." + type.getMethodName() + "(callback) needs a function");
        }
        registry.register(context, type, callback);
    }
}
