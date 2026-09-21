package com.scriptcraft.server;

import com.scriptcraft.core.ScriptCraftLog;

/**
 * Common (server safe) proxy. Anything client-only lives in {@code com.scriptcraft.client} and is
 * only ever touched through these methods, so a dedicated server never loads a client class.
 */
public class CommonProxy {

    public void init() {
        // nothing to register on a dedicated server
    }

    public boolean isClient() {
        return false;
    }

    public void openIde() {
        ScriptCraftLog.warn("The ScriptCraft IDE is client-only; it cannot be opened on a dedicated server");
    }
}
