// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common;

import net.minecraft.server.MinecraftServer;
import net.minecraftforge.fml.relauncher.Side;

public class FMLCommonHandler {
    private static final FMLCommonHandler INSTANCE = new FMLCommonHandler();

    private MinecraftServer server;
    private Side side = Side.CLIENT;

    public static FMLCommonHandler instance() { return INSTANCE; }
    public Side getSide() { return side; }
    public Side getEffectiveSide() { return side; }
    public MinecraftServer getMinecraftServerInstance() { return server; }

    // harness helpers
    public void setServer(MinecraftServer serverIn) { this.server = serverIn; }
    public void setSide(Side sideIn) { this.side = sideIn; }
}
