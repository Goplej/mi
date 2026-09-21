package com.scriptcraft.api;

import com.scriptcraft.core.ScriptCraftLog;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.entity.player.EntityPlayerMP;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.util.ResourceLocation;
import net.minecraft.util.text.TextComponentString;
import net.minecraft.world.World;

/**
 * {@code player} - the player that started the script.
 *
 * <p>When a script is started from the server console there is no player; every method then
 * returns a neutral value and {@link #isValid()} is {@code false}, so scripts can check instead of
 * crashing. Calls that would have changed something (sending a message, teleporting, setting
 * health) say so in the log instead of doing nothing silently - a script that sends chat from the
 * console used to look like it ran and simply had no effect.
 */
public final class PlayerApi {

    private final EntityPlayer player;
    private final String scriptName;
    private boolean warnedUnavailable;

    public PlayerApi(EntityPlayer player) {
        this(player, null);
    }

    public PlayerApi(EntityPlayer player, String scriptName) {
        this.player = player;
        this.scriptName = scriptName;
    }

    public boolean isValid() {
        return player != null;
    }

    public String getName() {
        return player == null ? "" : player.getName();
    }

    public void sendMessage(String message) {
        if (player == null) {
            unavailable("player.sendMessage(\"" + message + "\")");
            return;
        }
        player.sendStatusMessage(new TextComponentString(String.valueOf(message)), false);
    }

    public void sendActionBar(String message) {
        if (player == null) {
            unavailable("player.sendActionBar(\"" + message + "\")");
            return;
        }
        player.sendStatusMessage(new TextComponentString(String.valueOf(message)), true);
    }

    /**
     * Reports the first ignored call of a script that has no player, once per API object so a loop
     * cannot flood the log.
     */
    private void unavailable(String call) {
        if (warnedUnavailable) {
            return;
        }
        warnedUnavailable = true;
        String prefix = scriptName == null ? "[ScriptCraft]" : "[ScriptCraft:" + scriptName + "]";
        ScriptCraftLog.warn(prefix + " " + call + " was ignored: no player - the script was started "
                + "from the server console. Start it in game (/script run " + (scriptName == null ? "<file>" : scriptName)
                + " as a player) or query player.isValid() first.");
    }

    public double getX() {
        return player == null ? 0D : player.posX;
    }

    public double getY() {
        return player == null ? 0D : player.posY;
    }

    public double getZ() {
        return player == null ? 0D : player.posZ;
    }

    public int getBlockX() {
        return player == null ? 0 : (int) Math.floor(player.posX);
    }

    public int getBlockY() {
        return player == null ? 0 : (int) Math.floor(player.posY);
    }

    public int getBlockZ() {
        return player == null ? 0 : (int) Math.floor(player.posZ);
    }

    public double getHealth() {
        return player == null ? 0D : player.getHealth();
    }

    public double getMaxHealth() {
        return player == null ? 0D : player.getMaxHealth();
    }

    public void setHealth(double health) {
        if (player == null) {
            unavailable("player.setHealth(" + health + ")");
            return;
        }
        player.setHealth((float) health);
    }

    public int getFoodLevel() {
        return player == null ? 0 : player.getFoodStats().getFoodLevel();
    }

    public void setFoodLevel(int level) {
        if (player == null) {
            unavailable("player.setFoodLevel(" + level + ")");
            return;
        }
        player.getFoodStats().setFoodLevel(level);
    }

    public boolean isSneaking() {
        return player != null && player.isSneaking();
    }

    public boolean isSprinting() {
        return player != null && player.isSprinting();
    }

    public boolean isOnGround() {
        return player != null && player.onGround;
    }

    public boolean isInWater() {
        return player != null && player.isInWater();
    }

    /** The world this player is currently in, resolved on every call. */
    public WorldApi getWorld() {
        return new WorldApi(player);
    }

    public String getWorldName() {
        World world = player == null ? null : player.world;
        return world == null ? "" : world.getWorldInfo().getWorldName();
    }

    public int getDimension() {
        return player == null ? 0 : player.dimension;
    }

    public ItemApi getHeldItem() {
        return new ItemApi(player == null ? null : player.getHeldItemMainhand());
    }

    public void teleport(double x, double y, double z) {
        if (player == null) {
            unavailable("player.teleport(" + x + ", " + y + ", " + z + ")");
            return;
        }
        player.setPositionAndUpdate(x, y, z);
    }

    /** Gives an item by registry name, e.g. {@code player.giveItem("minecraft:diamond", 5)}. */
    public boolean giveItem(String name, int count) {
        if (player == null) {
            return false;
        }
        Item item = Item.REGISTRY.getObject(new ResourceLocation(String.valueOf(name)));
        if (item == null) {
            throw new IllegalArgumentException("Unknown item: " + name);
        }
        ItemStack stack = new ItemStack(item, Math.max(1, count));
        return player.inventory.addItemStackToInventory(stack);
    }

    /** Disconnects the player. Only works for players on a server. */
    public void kick(String reason) {
        if (player instanceof EntityPlayerMP) {
            ((EntityPlayerMP) player).connection.disconnect(new TextComponentString(String.valueOf(reason)));
        }
    }

    @Override
    public String toString() {
        return "Player(" + getName() + ")";
    }
}
