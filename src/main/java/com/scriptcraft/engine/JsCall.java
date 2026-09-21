package com.scriptcraft.engine;

import javax.script.Invocable;
import javax.script.ScriptEngine;

/** Calling JavaScript functions from Java without depending on Nashorn internals. */
public final class JsCall {

    private JsCall() {
    }

    /** True for anything the engine returned as a JavaScript function. */
    public static boolean isFunction(ScriptEngine engine, Object value) {
        if (value == null) {
            return false;
        }
        String type = String.valueOf(value.getClass().getSimpleName());
        if (type.contains("Function") || type.contains("Mirror")) {
            return true;
        }
        // Fall back to a duck test: anything with a callable "call" member works for us.
        return engine instanceof Invocable && hasCallMember(value);
    }

    private static boolean hasCallMember(Object value) {
        try {
            return value.getClass().getMethod("call", Object.class, Object[].class) != null;
        } catch (NoSuchMethodException e) {
            return false;
        }
    }
}
