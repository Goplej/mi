package com.scriptcraft.api;

import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.engine.TimerScheduler;

/**
 * {@code timer} - delayed and repeating callbacks.
 *
 * <pre>
 * var id = timer.after(1000, function() { console.log("Hello"); });
 * timer.every(1000, function() { player.setFoodLevel(20); });
 * timer.cancel(id);
 * </pre>
 *
 * Every timer belongs to the script that created it, so {@code /script stop} cancels them all.
 */
public final class TimerApi {

    private final ScriptContext context;
    private final TimerScheduler scheduler;

    public TimerApi(ScriptContext context, TimerScheduler scheduler) {
        this.context = context;
        this.scheduler = scheduler;
    }

    /** Runs {@code callback} once after {@code delayMillis} milliseconds. Returns the timer id. */
    public int after(Object delayMillis, Object callback) {
        return scheduler.schedule(context, toMillis(delayMillis), 0L, false, callback);
    }

    /** Runs {@code callback} every {@code intervalMillis} milliseconds. Returns the timer id. */
    public int every(Object intervalMillis, Object callback) {
        long interval = toMillis(intervalMillis);
        return scheduler.schedule(context, interval, interval, true, callback);
    }

    public boolean cancel(Object timerId) {
        return scheduler.cancel(toInt(timerId));
    }

    /** How many timers this script currently owns. */
    public int active() {
        return scheduler.countFor(context);
    }

    private static long toMillis(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong(((String) value).trim());
            } catch (NumberFormatException e) {
                return 0L;
            }
        }
        return 0L;
    }

    private static int toInt(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return -1;
        }
    }
}
