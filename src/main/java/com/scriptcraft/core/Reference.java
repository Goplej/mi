package com.scriptcraft.core;

/** Constants shared by the whole mod. */
public final class Reference {

    public static final String MOD_ID = "scriptcraft";
    public static final String NAME = "ScriptCraft";
    public static final String VERSION = "0.1.0";
    public static final String MC_VERSION = "1.12.2";

    /** Folder created inside the game directory (.minecraft/scriptcraft). */
    public static final String FOLDER = "scriptcraft";
    public static final String SCRIPTS_SUBDIR = "scripts";
    public static final String CONFIG_SUBDIR = "config";
    public static final String LOGS_SUBDIR = "logs";

    public static final String CLIENT_PROXY = "com.scriptcraft.client.ClientProxy";
    public static final String COMMON_PROXY = "com.scriptcraft.server.CommonProxy";

    /** Length of one Minecraft tick in milliseconds. */
    public static final long MILLIS_PER_TICK = 50L;

    private Reference() {
    }
}
