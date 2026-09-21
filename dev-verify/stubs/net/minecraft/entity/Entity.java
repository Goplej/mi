// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity;

import net.minecraft.command.ICommandSender;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.util.text.TextComponentString;
import net.minecraft.world.World;

public class Entity implements ICommandSender {
    private static int nextId = 1;

    public double posX;
    public double posY;
    public double posZ;
    public int dimension;
    public World world;
    public boolean isDead;
    public boolean onGround;

    private final int entityId = nextId++;
    private String customNameTag = "";
    private String typeName = "minecraft:pig";
    private boolean sneaking;
    private boolean sprinting;
    private boolean inWater;

    public Entity() { }
    public Entity(World worldIn) { this.world = worldIn; }

    public int getEntityId() { return entityId; }
    public String getName() { return customNameTag.isEmpty() ? typeName : customNameTag; }
    public String getCustomNameTag() { return customNameTag; }
    public ITextComponent getDisplayName() { return new TextComponentString(getName()); }
    public World getEntityWorld() { return world; }
    public BlockPos getPosition() { return new BlockPos((int) Math.floor(posX), (int) Math.floor(posY), (int) Math.floor(posZ)); }
    public boolean isSneaking() { return sneaking; }
    public boolean isSprinting() { return sprinting; }
    public boolean isInWater() { return inWater; }
    public void setDead() { isDead = true; }

    public void setPosition(double x, double y, double z) { posX = x; posY = y; posZ = z; }
    public void setPositionAndUpdate(double x, double y, double z) { setPosition(x, y, z); }

    // ICommandSender (Entity implements it in 1.12.2)
    public boolean canUseCommand(int permLevel, String commandName) { return true; }
    public MinecraftServer getServer() { return null; }
    public void sendMessage(ITextComponent component) { sendStatusMessage(component, false); }
    public void sendStatusMessage(ITextComponent chatComponent, boolean actionBar) { }

    // harness helpers
    public void setTypeName(String name) { this.typeName = name; }
    public void setCustomNameTag(String name) { this.customNameTag = name; }
    public void setSneaking(boolean value) { this.sneaking = value; }
    public void setSprinting(boolean value) { this.sprinting = value; }
    public void setInWater(boolean value) { this.inWater = value; }
}
