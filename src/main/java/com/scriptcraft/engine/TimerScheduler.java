package com.scriptcraft.engine;

import com.scriptcraft.core.Reference;
import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.core.ScriptCraftLog;
import com.scriptcraft.security.ScriptSandbox;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Drives {@code timer.after()} / {@code timer.every()} for every script.
 *
 * <p>There is exactly one scheduler and it is ticked from the server tick, so timer callbacks
 * always run on the server thread next to the game logic. Every callback is limited twice per
 * tick - by count and by wall clock time - so one runaway script cannot freeze the server, and a
 * throwing callback is reported and cancelled instead of spamming the log forever.
 */
public final class TimerScheduler {

    private static final class Timer {
        final int id;
        final ScriptContext context;
        final Object callback;
        final long intervalTicks;
        final boolean repeating;
        long dueAtTick;

        Timer(int id, ScriptContext context, Object callback, long intervalTicks, boolean repeating, long dueAtTick) {
            this.id = id;
            this.context = context;
            this.callback = callback;
            this.intervalTicks = intervalTicks;
            this.repeating = repeating;
            this.dueAtTick = dueAtTick;
        }
    }

    private final Map<Integer, Timer> timers = new LinkedHashMap<Integer, Timer>();
    private int nextId = 1;
    private long currentTick;

    /**
     * @param delayMs    delay before the first run
     * @param intervalMs period for repeating timers, ignored when {@code repeating} is false
     * @return the timer id, or -1 when the script already owns too many timers
     */
    public synchronized int schedule(ScriptContext context, long delayMs, long intervalMs, boolean repeating, Object callback) {
        if (countFor(context) >= ScriptCraftConfig.maxTimersPerScript) {
            ScriptCraftLog.warn("[" + context.getName() + "] timer limit reached ("
                    + ScriptCraftConfig.maxTimersPerScript + "), timer not created");
            return -1;
        }
        long delayTicks = toTicks(delayMs);
        long intervalTicks = repeating ? Math.max(1L, toTicks(intervalMs)) : 0L;
        int id = nextId++;
        timers.put(Integer.valueOf(id),
                new Timer(id, context, callback, intervalTicks, repeating, currentTick + delayTicks));
        context.addTimer(id);
        return id;
    }

    public synchronized boolean cancel(int id) {
        Timer timer = timers.remove(Integer.valueOf(id));
        if (timer == null) {
            return false;
        }
        timer.context.removeTimer(id);
        return true;
    }

    /** Cancels every timer owned by a context. Returns how many were removed. */
    public synchronized int cancelFor(ScriptContext context) {
        int removed = 0;
        for (Iterator<Timer> it = timers.values().iterator(); it.hasNext(); ) {
            Timer timer = it.next();
            if (timer.context == context) {
                it.remove();
                removed++;
            }
        }
        return removed;
    }

    public synchronized int countFor(ScriptContext context) {
        int count = 0;
        for (Timer timer : timers.values()) {
            if (timer.context == context) {
                count++;
            }
        }
        return count;
    }

    public synchronized int size() {
        return timers.size();
    }

    public synchronized long getTick() {
        return currentTick;
    }

    public synchronized void reset() {
        timers.clear();
        currentTick = 0L;
    }

    /** Called once per server tick. */
    public synchronized void tick() {
        currentTick++;
        if (timers.isEmpty()) {
            return;
        }

        List<Timer> due = new ArrayList<Timer>();
        for (Timer timer : timers.values()) {
            if (timer.dueAtTick <= currentTick) {
                due.add(timer);
            }
        }
        if (due.isEmpty()) {
            return;
        }

        int budget = ScriptCraftConfig.maxTimerCallbacksPerTick;
        long deadline = System.currentTimeMillis() + ScriptCraftConfig.maxTimerMillisPerTick;
        int executed = 0;

        for (Timer timer : due) {
            if (executed >= budget || System.currentTimeMillis() >= deadline) {
                // Push the rest to the next tick instead of dropping them.
                timer.dueAtTick = currentTick + 1L;
                continue;
            }
            executed++;
            fire(timer);
        }
    }

    private void fire(Timer timer) {
        ScriptContext context = timer.context;
        if (context.getState() == ScriptState.STOPPED) {
            timers.remove(Integer.valueOf(timer.id));
            return;
        }
        if (timer.repeating) {
            timer.dueAtTick = currentTick + timer.intervalTicks;
        } else {
            timers.remove(Integer.valueOf(timer.id));
            context.removeTimer(timer.id);
        }

        try {
            ScriptSandbox.invoke(context.getEngine(), timer.callback, Long.valueOf(currentTick));
        } catch (Throwable t) {
            ScriptError error = ScriptError.of(context.getName(), t);
            context.setLastError(error);
            ScriptCraftLog.error(error.format());
            // A broken repeating timer would fire forever; drop it and tell the user.
            if (timer.repeating) {
                timers.remove(Integer.valueOf(timer.id));
                context.removeTimer(timer.id);
                ScriptCraftLog.warn("[" + context.getName() + "] timer " + timer.id + " cancelled after the error above");
            }
        }
    }

    private static long toTicks(long millis) {
        if (millis <= 0L) {
            return 1L;
        }
        return Math.max(1L, Math.round((double) millis / (double) Reference.MILLIS_PER_TICK));
    }
}
