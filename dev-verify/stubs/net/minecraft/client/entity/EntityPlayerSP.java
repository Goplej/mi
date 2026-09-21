// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.entity;

import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.world.World;

public class EntityPlayerSP extends EntityPlayer {
    public EntityPlayerSP() { }
    public EntityPlayerSP(World worldIn) { super(worldIn); }
}
