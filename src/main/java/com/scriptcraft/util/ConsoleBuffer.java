package com.scriptcraft.util;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.List;

/**
 * Ring buffer with the most recent log lines. The in-game IDE console pane renders a
 * snapshot of this buffer, and every line written through {@code ScriptCraftLog} ends up here.
 */
public final class ConsoleBuffer {

    private static final int MAX_LINES = 400;
    private static final Deque<String> LINES = new ArrayDeque<String>();

    private ConsoleBuffer() {
    }

    public static void push(String level, String message) {
        String stamp = new SimpleDateFormat("HH:mm:ss").format(new Date());
        synchronized (LINES) {
            LINES.addLast("[" + stamp + "] [" + level + "] " + message);
            while (LINES.size() > MAX_LINES) {
                LINES.removeFirst();
            }
        }
    }

    public static List<String> snapshot() {
        synchronized (LINES) {
            return new ArrayList<String>(LINES);
        }
    }

    public static void clear() {
        synchronized (LINES) {
            LINES.clear();
        }
    }
}
