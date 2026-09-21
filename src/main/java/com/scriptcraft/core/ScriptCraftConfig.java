package com.scriptcraft.core;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Properties;

/**
 * Loads {@code .minecraft/scriptcraft/config/scriptcraft.properties}.
 * Missing keys fall back to the defaults below; the file is written on first start so users can
 * discover every option.
 */
public final class ScriptCraftConfig {

    public static boolean sandboxEnabled = true;
    public static boolean fileLogging = true;
    public static boolean copyExamples = true;
    public static boolean autoLoadOnServerStart = false;

    /** Operator level required for /script. Single player worlds always allow the local player. */
    public static int commandPermissionLevel = 2;

    public static int maxTimersPerScript = 200;
    public static int maxTimerCallbacksPerTick = 64;
    public static long maxTimerMillisPerTick = 8L;

    public static int maxTickHandlersPerTick = 256;
    public static long maxTickMillisPerTick = 8L;

    private static final Properties PROPS = new Properties();
    private static File configFile;

    private ScriptCraftConfig() {
    }

    public static void load(File file) {
        configFile = file;
        PROPS.clear();
        if (file.isFile()) {
            InputStream in = null;
            try {
                in = new FileInputStream(file);
                PROPS.load(in);
            } catch (IOException e) {
                ScriptCraftLog.warn("Could not read " + file.getName() + ": " + e.getMessage());
            } finally {
                close(in);
            }
        }

        sandboxEnabled = bool("sandbox.enabled", sandboxEnabled);
        fileLogging = bool("log.toFile", fileLogging);
        copyExamples = bool("scripts.copyExamples", copyExamples);
        autoLoadOnServerStart = bool("scripts.autoLoadOnServerStart", autoLoadOnServerStart);
        commandPermissionLevel = integer("command.permissionLevel", commandPermissionLevel);
        maxTimersPerScript = integer("timer.maxPerScript", maxTimersPerScript);
        maxTimerCallbacksPerTick = integer("timer.maxCallbacksPerTick", maxTimerCallbacksPerTick);
        maxTimerMillisPerTick = integer("timer.maxMillisPerTick", (int) maxTimerMillisPerTick);
        maxTickHandlersPerTick = integer("tick.maxHandlersPerTick", maxTickHandlersPerTick);
        maxTickMillisPerTick = integer("tick.maxMillisPerTick", (int) maxTickMillisPerTick);

        writeIfMissing();
    }

    private static void writeIfMissing() {
        if (configFile == null || configFile.isFile()) {
            return;
        }
        File parent = configFile.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            return;
        }
        PROPS.setProperty("sandbox.enabled", String.valueOf(sandboxEnabled));
        PROPS.setProperty("log.toFile", String.valueOf(fileLogging));
        PROPS.setProperty("scripts.copyExamples", String.valueOf(copyExamples));
        PROPS.setProperty("scripts.autoLoadOnServerStart", String.valueOf(autoLoadOnServerStart));
        PROPS.setProperty("command.permissionLevel", String.valueOf(commandPermissionLevel));
        PROPS.setProperty("timer.maxPerScript", String.valueOf(maxTimersPerScript));
        PROPS.setProperty("timer.maxCallbacksPerTick", String.valueOf(maxTimerCallbacksPerTick));
        PROPS.setProperty("timer.maxMillisPerTick", String.valueOf(maxTimerMillisPerTick));
        PROPS.setProperty("tick.maxHandlersPerTick", String.valueOf(maxTickHandlersPerTick));
        PROPS.setProperty("tick.maxMillisPerTick", String.valueOf(maxTickMillisPerTick));

        OutputStream out = null;
        try {
            out = new FileOutputStream(configFile);
            PROPS.store(out, "ScriptCraft configuration");
        } catch (IOException e) {
            ScriptCraftLog.warn("Could not write " + configFile.getName() + ": " + e.getMessage());
        } finally {
            close(out);
        }
    }

    private static boolean bool(String key, boolean fallback) {
        String value = PROPS.getProperty(key);
        if (value == null) {
            return fallback;
        }
        return Boolean.parseBoolean(value.trim());
    }

    private static int integer(String key, int fallback) {
        String value = PROPS.getProperty(key);
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static void close(java.io.Closeable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (IOException ignored) {
                // nothing useful to do here
            }
        }
    }
}
