// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.event;

import net.minecraft.command.ICommand;
import net.minecraft.server.MinecraftServer;

import java.util.ArrayList;
import java.util.List;

public class FMLServerStartingEvent {
    private final MinecraftServer server;
    private final List<ICommand> commands = new ArrayList<ICommand>();

    public FMLServerStartingEvent(MinecraftServer serverIn) { this.server = serverIn; }

    public MinecraftServer getServer() { return server; }

    public void registerServerCommand(ICommand command) { commands.add(command); }

    // harness helper
    public List<ICommand> registeredCommands() { return commands; }
}
