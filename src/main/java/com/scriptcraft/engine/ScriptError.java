package com.scriptcraft.engine;

import javax.script.ScriptException;

/** A script failure reduced to what a player needs to see. */
public final class ScriptError {

    private final String file;
    private final int line;
    private final String message;
    private final String stackTrace;

    public ScriptError(String file, int line, String message, String stackTrace) {
        this.file = file;
        this.line = line;
        this.message = message;
        this.stackTrace = stackTrace;
    }

    /** Extracts file/line/message from any throwable thrown by the engine or by a callback. */
    public static ScriptError of(String defaultFile, Throwable throwable) {
        Throwable root = throwable;
        while (root.getCause() != null && root.getCause() != root && !(root instanceof ScriptException)) {
            root = root.getCause();
        }
        if (root instanceof ScriptException) {
            ScriptException se = (ScriptException) root;
            String name = se.getFileName();
            return new ScriptError(
                    name == null || name.isEmpty() ? defaultFile : name,
                    se.getLineNumber(),
                    clean(se.getMessage()),
                    stackOf(throwable));
        }
        return new ScriptError(defaultFile, -1, clean(String.valueOf(root.getMessage())), stackOf(throwable));
    }

    public String getFile() {
        return file;
    }

    public int getLine() {
        return line;
    }

    public String getMessage() {
        return message;
    }

    public String getStackTrace() {
        return stackTrace;
    }

    /**
     * The format shown in chat and written to the log:
     * <pre>
     * Script error
     * File: example.js
     * Line: 12
     * Error: ReferenceError: "foo" is not defined
     * </pre>
     */
    public String format() {
        StringBuilder builder = new StringBuilder("Script error\n");
        builder.append("File: ").append(file).append('\n');
        builder.append("Line: ").append(line >= 0 ? String.valueOf(line) : "unknown").append('\n');
        builder.append("Error: ").append(message);
        return builder.toString();
    }

    @Override
    public String toString() {
        return format();
    }

    private static String clean(String message) {
        if (message == null) {
            return "unknown error";
        }
        int newline = message.indexOf('\n');
        return newline >= 0 ? message.substring(0, newline) : message;
    }

    private static String stackOf(Throwable throwable) {
        StringBuilder builder = new StringBuilder();
        StackTraceElement[] trace = throwable.getStackTrace();
        for (int i = 0; i < trace.length && i < 12; i++) {
            builder.append("    at ").append(trace[i]).append('\n');
        }
        return builder.toString();
    }
}
