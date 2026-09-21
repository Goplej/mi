package com.scriptcraft.events;

import com.scriptcraft.api.EntityApi;
import com.scriptcraft.api.PlayerApi;

/**
 * The object handed to JavaScript listeners. Nashorn exposes the getters as properties, so a
 * script can write both {@code event.getPlayer()} and {@code event.player}.
 *
 * <p>Only the fields relevant to the event type are filled in; the rest stay {@code null}/0.
 */
public final class ScriptEventObject {

    private final String type;

    private PlayerApi player;
    private EntityApi entity;
    private String message;
    private String block;
    private int blockMeta;
    private String cause;
    private double x;
    private double y;
    private double z;
    private boolean hasPosition;
    private long tick;
    private boolean canceled;

    public ScriptEventObject(String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }

    public PlayerApi getPlayer() {
        return player;
    }

    public void setPlayer(PlayerApi player) {
        this.player = player;
    }

    public EntityApi getEntity() {
        return entity;
    }

    public void setEntity(EntityApi entity) {
        this.entity = entity;
    }

    public String getMessage() {
        return message;
    }

    /** Chat listeners can rewrite the message before it is broadcast. */
    public void setMessage(String message) {
        this.message = message;
    }

    public String getBlock() {
        return block;
    }

    public void setBlock(String block) {
        this.block = block;
    }

    public int getBlockMeta() {
        return blockMeta;
    }

    public void setBlockMeta(int blockMeta) {
        this.blockMeta = blockMeta;
    }

    public String getCause() {
        return cause;
    }

    public void setCause(String cause) {
        this.cause = cause;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public double getZ() {
        return z;
    }

    public void setPosition(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.hasPosition = true;
    }

    public boolean hasPosition() {
        return hasPosition;
    }

    public long getTick() {
        return tick;
    }

    public void setTick(long tick) {
        this.tick = tick;
    }

    /** Cancels the underlying Forge event when it is cancelable (chat, block break, death). */
    public void cancel() {
        this.canceled = true;
    }

    public boolean isCanceled() {
        return canceled;
    }

    @Override
    public String toString() {
        return "ScriptEvent(" + type + ")";
    }
}
