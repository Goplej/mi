package com.scriptcraft.api;

import com.scriptcraft.core.GameRefs;
import com.scriptcraft.engine.TimerScheduler;
import net.minecraft.command.ICommandManager;
import net.minecraft.entity.player.EntityPlayerMP;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.text.TextComponentString;

import java.util.ArrayList;
import java.util.List;

/** {@code server} - the running Minecraft server (integrated or dedicated). */
public final class ServerApi {

    private final TimerScheduler timers;

    public ServerApi(TimerScheduler timers) {
        this.timers = timers;
    }

    /** False while the game sits in the main menu. */
    public boolean isAvailable() {
        return GameRefs.server() != null;
    }

    public boolean isDedicated() {
        return GameRefs.isDedicatedServer();
    }

    /** True when the mod runs inside a Minecraft client (single player included). */
    public boolean isClient() {
        return GameRefs.isClientJvm();
    }

    public String getName() {
        MinecraftServer server = GameRefs.server();
        return server == null ? "" : server.getServerModName();
    }

    public int getPlayerCount() {
        MinecraftServer server = GameRefs.server();
        return server == null ? 0 : server.getPlayerList().getPlayers().size();
    }

    public List<PlayerApi> getPlayers() {
        List<PlayerApi> players = new ArrayList<PlayerApi>();
        MinecraftServer server = GameRefs.server();
        if (server != null) {
            for (EntityPlayerMP player : server.getPlayerList().getPlayers()) {
                players.add(new PlayerApi(player));
            }
        }
        return players;
    }

    /** Looks a player up by name. Returns a {@link PlayerApi} whose {@code isValid()} is false
     *  when nobody with that name is online. */
    public PlayerApi getPlayer(String name) {
        MinecraftServer server = GameRefs.server();
        EntityPlayerMP player = server == null ? null : server.getPlayerList().getPlayerByUsername(String.valueOf(name));
        return new PlayerApi(player);
    }

    public void broadcast(String message) {
        MinecraftServer server = GameRefs.server();
        if (server != null) {
            server.getPlayerList().sendMessage(new TextComponentString(String.valueOf(message)));
        }
    }

    /** Runs a server command as the console, e.g. {@code server.runCommand("time set day")}. */
    public int runCommand(String command) {
        MinecraftServer server = GameRefs.server();
        if (server == null) {
            return 0;
        }
        String raw = String.valueOf(command).trim();
        if (raw.startsWith("/")) {
            raw = raw.substring(1);
        }
        ICommandManager commands = server.getCommandManager();
        return commands.executeCommand(server, raw);
    }

    /** Current server tick, the same counter timers see. */
    public long getTick() {
        return timers.getTick();
    }
}
