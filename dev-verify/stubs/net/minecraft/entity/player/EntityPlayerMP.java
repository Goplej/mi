// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity.player;

import net.minecraft.network.NetHandlerPlayServer;
import net.minecraft.world.World;

public class EntityPlayerMP extends EntityPlayer {
    public NetHandlerPlayServer connection = new NetHandlerPlayServer();

    public EntityPlayerMP() { }
    public EntityPlayerMP(World worldIn) { super(worldIn); }
}
