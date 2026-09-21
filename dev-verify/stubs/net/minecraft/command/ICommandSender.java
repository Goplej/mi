// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.command;

import net.minecraft.server.MinecraftServer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.world.World;

public interface ICommandSender {
    String getName();
    boolean canUseCommand(int permLevel, String commandName);
    World getEntityWorld();
    MinecraftServer getServer();
    BlockPos getPosition();
    void sendMessage(ITextComponent component);
}
