package com.scriptcraft.core;

import net.minecraft.server.MinecraftServer;

/**
 * Minecraft world access is only safe on the server thread. Everything the IDE starts from the
 * render thread goes through here.
 */
public final class ServerThreads {

    private ServerThreads() {
    }

    public static void run(Runnable task) {
        MinecraftServer server = GameRefs.server();
        if (server == null || server.isCallingFromMinecraftThread()) {
            task.run();
            return;
        }
        server.addScheduledTask(task);
    }

    public static boolean isServerThread() {
        MinecraftServer server = GameRefs.server();
        return server != null && server.isCallingFromMinecraftThread();
    }
}
