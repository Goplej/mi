package com.scriptcraft.core;

import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.World;
import net.minecraftforge.fml.common.FMLCommonHandler;
import net.minecraftforge.fml.relauncher.Side;

/**
 * The single place that reaches for global Minecraft/Forge state.
 * Keeping it in one class makes the client/server split obvious and keeps client-only classes out
 * of any code path a dedicated server can take.
 */
public final class GameRefs {

    private GameRefs() {
    }

    /** The running server, or {@code null} when the game sits in the main menu. */
    public static MinecraftServer server() {
        FMLCommonHandler handler = FMLCommonHandler.instance();
        return handler == null ? null : handler.getMinecraftServerInstance();
    }

    /** True when the JVM is a Minecraft client (integrated server counts as a client). */
    public static boolean isClientJvm() {
        FMLCommonHandler handler = FMLCommonHandler.instance();
        return handler != null && handler.getSide() == Side.CLIENT;
    }

    /** True when this is a dedicated server process. */
    public static boolean isDedicatedServer() {
        MinecraftServer server = server();
        return server != null && server.isDedicatedServer();
    }

    /**
     * The world a script should act on: the owner's world when a player started the script,
     * otherwise the overworld of the running server. Returns {@code null} outside a world.
     */
    public static World worldFor(Object owner) {
        if (owner instanceof EntityPlayer) {
            World world = ((EntityPlayer) owner).world;
            if (world != null) {
                return world;
            }
        }
        MinecraftServer server = server();
        return server == null ? null : server.getEntityWorld();
    }
}
