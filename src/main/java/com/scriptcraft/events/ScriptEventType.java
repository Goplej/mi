package com.scriptcraft.events;

/** Every event a script can subscribe to. The method name is what scripts call on {@code events}. */
public enum ScriptEventType {

    PLAYER_JOIN("onPlayerJoin"),
    PLAYER_QUIT("onPlayerQuit"),
    PLAYER_CHAT("onPlayerChat"),
    PLAYER_BREAK_BLOCK("onPlayerBreakBlock"),
    PLAYER_PLACE_BLOCK("onPlayerPlaceBlock"),
    PLAYER_DEATH("onPlayerDeath"),
    ENTITY_SPAWN("onEntitySpawn"),
    TICK("onTick");

    private final String methodName;

    ScriptEventType(String methodName) {
        this.methodName = methodName;
    }

    public String getMethodName() {
        return methodName;
    }

    public static ScriptEventType fromMethodName(String name) {
        for (ScriptEventType type : values()) {
            if (type.methodName.equals(name)) {
                return type;
            }
        }
        return null;
    }
}
