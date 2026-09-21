package com.scriptcraft.api;

import com.scriptcraft.core.GameRefs;
import com.scriptcraft.core.Reference;
import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.filesystem.ScriptDirectories;
import com.scriptcraft.filesystem.ScriptFileManager;

import java.io.File;
import java.util.List;

/** {@code scriptcraft} - read-only facts about the mod and the script that is running. */
public final class InfoApi {

    private final ScriptContext context;

    public InfoApi(ScriptContext context) {
        this.context = context;
    }

    public String getVersion() {
        return Reference.VERSION;
    }

    public String getMcVersion() {
        return Reference.MC_VERSION;
    }

    public String getScript() {
        return context.getName();
    }

    public boolean isClient() {
        return GameRefs.isClientJvm();
    }

    public boolean isDedicatedServer() {
        return GameRefs.isDedicatedServer();
    }

    public String getScriptsDir() {
        File dir = ScriptDirectories.scripts();
        return dir == null ? "" : dir.getAbsolutePath();
    }

    public List<String> listScripts() {
        return ScriptFileManager.listScripts();
    }
}
