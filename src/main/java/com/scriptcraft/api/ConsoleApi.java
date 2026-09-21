package com.scriptcraft.api;

import com.scriptcraft.core.ScriptCraftLog;
import com.scriptcraft.engine.ScriptContext;

/**
 * {@code console} - script output.
 * Lines reach the Forge log, the log file and the IDE console pane, prefixed with the script name:
 * {@code [ScriptCraft:example.js] Hello world!}
 */
public final class ConsoleApi {

    private final ScriptContext context;

    public ConsoleApi(ScriptContext context) {
        this.context = context;
    }

    public void log(Object... args) {
        ScriptCraftLog.script(context.getName(), "INFO", join(args));
    }

    public void info(Object... args) {
        log(args);
    }

    public void warn(Object... args) {
        ScriptCraftLog.script(context.getName(), "WARN", join(args));
    }

    public void error(Object... args) {
        ScriptCraftLog.script(context.getName(), "ERROR", join(args));
    }

    private static String join(Object... args) {
        if (args == null || args.length == 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < args.length; i++) {
            if (i > 0) {
                builder.append(' ');
            }
            builder.append(args[i] == null ? "null" : String.valueOf(args[i]));
        }
        return builder.toString();
    }
}
