// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.server;

import com.google.common.util.concurrent.ListenableFuture;
import net.minecraft.command.ICommandManager;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.math.BlockPos;
import net.minecraft.server.management.PlayerList;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.world.World;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class MinecraftServer implements ICommandSender {
    private final PlayerList playerList = new PlayerList();
    private final World world = new World(false);
    private final List<Runnable> scheduled = new ArrayList<Runnable>();
    private final List<String> executedCommands = new ArrayList<String>();

    private boolean dedicated;
    private boolean onServerThread = true;
    private String motd = "ScriptCraft test server";

    private final ICommandManager commandManager = new ICommandManager() {
        public int executeCommand(ICommandSender sender, String rawCommand) {
            executedCommands.add(rawCommand);
            return 1;
        }
    };

    public File getDataDirectory() { return new File("."); }
    public void sendMessage(ITextComponent component) { playerList.sendMessage(component); }
    public boolean isDedicatedServer() { return dedicated; }
    public PlayerList getPlayerList() { return playerList; }
    public World getEntityWorld() { return world; }
    public ICommandManager getCommandManager() { return commandManager; }
    public String getServerModName() { return "ScriptCraftTestServer"; }

    public String getName() { return "Server"; }
    public boolean canUseCommand(int permLevel, String commandName) { return true; }
    public BlockPos getPosition() { return new BlockPos(0, 0, 0); }
    public MinecraftServer getServer() { return this; }

    public boolean isCallingFromMinecraftThread() { return onServerThread; }

    public ListenableFuture<Object> addScheduledTask(Runnable runnableToSchedule) {
        scheduled.add(runnableToSchedule);
        return null;
    }

    // harness helpers
    public void setDedicated(boolean value) { this.dedicated = value; }
    public void setOnServerThread(boolean value) { this.onServerThread = value; }
    public void setMotd(String value) { this.motd = value; }
    public List<Runnable> scheduledTasks() { return scheduled; }
    public List<String> executedCommands() { return executedCommands; }
}
