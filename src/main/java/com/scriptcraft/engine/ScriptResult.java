package com.scriptcraft.engine;

/** Outcome of run/stop/reload, so the command layer never has to touch exceptions. */
public final class ScriptResult {

    private final boolean success;
    private final String message;
    private final ScriptError error;

    private ScriptResult(boolean success, String message, ScriptError error) {
        this.success = success;
        this.message = message;
        this.error = error;
    }

    public static ScriptResult ok(String message) {
        return new ScriptResult(true, message, null);
    }

    public static ScriptResult fail(String message) {
        return new ScriptResult(false, message, null);
    }

    public static ScriptResult fail(ScriptError error) {
        return new ScriptResult(false, error.getMessage(), error);
    }

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public ScriptError getError() {
        return error;
    }
}
