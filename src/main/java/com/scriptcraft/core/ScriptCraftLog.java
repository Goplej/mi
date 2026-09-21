package com.scriptcraft.core;

import com.scriptcraft.util.ConsoleBuffer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Single logging entry point for the mod.
 * Every line goes to the Forge log, to the in-game console buffer and (optionally) to a file
 * inside {@code .minecraft/scriptcraft/logs}.
 */
public final class ScriptCraftLog {

    private static final Logger LOGGER = LogManager.getLogger(Reference.NAME);

    private static File logFile;
    private static boolean fileLogging = true;

    private ScriptCraftLog() {
    }

    public static void setLogFile(File file) {
        logFile = file;
    }

    public static void setFileLogging(boolean enabled) {
        fileLogging = enabled;
    }

    public static void info(String message) {
        LOGGER.info(message);
        ConsoleBuffer.push("INFO", message);
        write("INFO", message);
    }

    public static void warn(String message) {
        LOGGER.warn(message);
        ConsoleBuffer.push("WARN", message);
        write("WARN", message);
    }

    public static void error(String message) {
        LOGGER.error(message);
        ConsoleBuffer.push("ERROR", message);
        write("ERROR", message);
    }

    public static void error(String message, Throwable throwable) {
        LOGGER.error(message, throwable);
        ConsoleBuffer.push("ERROR", message + " -> " + throwable);
        write("ERROR", message + " -> " + throwable);
    }

    /** Line emitted by a script through {@code console.log/warn/error}. */
    public static void script(String scriptName, String level, String message) {
        String line = "[" + Reference.NAME + ":" + scriptName + "] " + message;
        if ("WARN".equals(level)) {
            warn(line);
        } else if ("ERROR".equals(level)) {
            error(line);
        } else {
            info(line);
        }
    }

    private static void write(String level, String message) {
        File target = logFile;
        if (!fileLogging || target == null) {
            return;
        }
        File parent = target.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            return;
        }
        PrintWriter out = null;
        try {
            out = new PrintWriter(new FileWriter(target, true));
            out.println(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()) + " [" + level + "] " + message);
        } catch (IOException ignored) {
            // Logging must never break the game.
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }
}
