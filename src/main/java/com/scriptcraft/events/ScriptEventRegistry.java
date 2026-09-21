package com.scriptcraft.events;

import com.scriptcraft.engine.ScriptContext;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Listeners per event type, each one tagged with the {@link ScriptContext} that registered it.
 * That tag is what makes {@code /script stop example.js} remove exactly the listeners of that
 * script and nothing else.
 */
public final class ScriptEventRegistry {

    /** One JavaScript callback plus the context that owns it. */
    public static final class Listener {
        private final ScriptContext context;
        private final ScriptEventType type;
        private final Object callback;

        Listener(ScriptContext context, ScriptEventType type, Object callback) {
            this.context = context;
            this.type = type;
            this.callback = callback;
        }

        public ScriptContext getContext() {
            return context;
        }

        public ScriptEventType getType() {
            return type;
        }

        public Object getCallback() {
            return callback;
        }
    }

    private final Map<ScriptEventType, List<Listener>> listeners =
            new EnumMap<ScriptEventType, List<Listener>>(ScriptEventType.class);

    public synchronized void register(ScriptContext context, ScriptEventType type, Object callback) {
        List<Listener> list = listeners.get(type);
        if (list == null) {
            list = new ArrayList<Listener>();
            listeners.put(type, list);
        }
        list.add(new Listener(context, type, callback));
    }

    /** Snapshot, safe to iterate while listeners are added or removed. */
    public synchronized List<Listener> get(ScriptEventType type) {
        List<Listener> list = listeners.get(type);
        if (list == null || list.isEmpty()) {
            return Collections.emptyList();
        }
        return new ArrayList<Listener>(list);
    }

    public synchronized boolean hasListeners(ScriptEventType type) {
        List<Listener> list = listeners.get(type);
        return list != null && !list.isEmpty();
    }

    public synchronized int countFor(ScriptContext context) {
        int count = 0;
        for (List<Listener> list : listeners.values()) {
            for (Listener listener : list) {
                if (listener.context == context) {
                    count++;
                }
            }
        }
        return count;
    }

    public synchronized int countFor(ScriptEventType type) {
        List<Listener> list = listeners.get(type);
        return list == null ? 0 : list.size();
    }

    public synchronized int total() {
        int count = 0;
        for (List<Listener> list : listeners.values()) {
            count += list.size();
        }
        return count;
    }

    /** Removes every listener of one context. Returns how many were removed. */
    public synchronized int unregisterAll(ScriptContext context) {
        int removed = 0;
        for (List<Listener> list : listeners.values()) {
            for (Iterator<Listener> it = list.iterator(); it.hasNext(); ) {
                if (it.next().context == context) {
                    it.remove();
                    removed++;
                }
            }
        }
        return removed;
    }

    public synchronized void clear() {
        listeners.clear();
    }
}
