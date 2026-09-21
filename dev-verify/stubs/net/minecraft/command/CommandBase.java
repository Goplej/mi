// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.command;

import net.minecraft.server.MinecraftServer;
import net.minecraft.util.math.BlockPos;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

public abstract class CommandBase implements ICommand {

    public int getRequiredPermissionLevel() { return 4; }

    public boolean checkPermission(MinecraftServer server, ICommandSender sender) {
        return sender.canUseCommand(this.getRequiredPermissionLevel(), this.getName());
    }

    public List<String> getAliases() { return Collections.emptyList(); }

    public List<String> getTabCompletions(MinecraftServer server, ICommandSender sender, String[] args, BlockPos targetPos) {
        return Collections.emptyList();
    }

    public boolean isUsernameIndex(String[] args, int index) { return false; }

    public int compareTo(ICommand other) { return this.getName().compareTo(other.getName()); }

    public static List<String> getListOfStringsMatchingLastWord(String[] args, String... possibilities) {
        return getListOfStringsMatchingLastWord(args, java.util.Arrays.asList(possibilities));
    }

    public static List<String> getListOfStringsMatchingLastWord(String[] inputArgs, Collection<?> possibleCompletions) {
        String last = inputArgs[inputArgs.length - 1].toLowerCase(Locale.ROOT);
        List<String> result = new ArrayList<String>();
        for (Object candidate : possibleCompletions) {
            String value = String.valueOf(candidate);
            if (value.toLowerCase(Locale.ROOT).startsWith(last)) {
                result.add(value);
            }
        }
        return result;
    }
}
