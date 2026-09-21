// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.command;

import net.minecraft.server.MinecraftServer;
import net.minecraft.util.math.BlockPos;

import java.util.List;

public interface ICommand extends Comparable<ICommand> {
    String getName();
    String getUsage(ICommandSender sender);
    List<String> getAliases();
    void execute(MinecraftServer server, ICommandSender sender, String[] args) throws CommandException;
    boolean checkPermission(MinecraftServer server, ICommandSender sender);
    List<String> getTabCompletions(MinecraftServer server, ICommandSender sender, String[] args, BlockPos targetPos);
    boolean isUsernameIndex(String[] args, int index);
}
