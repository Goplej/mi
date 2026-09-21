// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client;

import com.google.common.util.concurrent.ListenableFuture;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.GuiScreen;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class Minecraft {
    private static final Minecraft INSTANCE = new Minecraft();

    public EntityPlayerSP player;
    public FontRenderer fontRenderer = new FontRenderer();
    public GuiScreen currentScreen;
    public int displayWidth = 854;
    public int displayHeight = 480;
    public final File gameDir = new File(".");

    private final List<Runnable> scheduled = new ArrayList<Runnable>();

    public static Minecraft getMinecraft() { return INSTANCE; }

    public void displayGuiScreen(GuiScreen guiScreenIn) { this.currentScreen = guiScreenIn; }

    public boolean isCallingFromMinecraftThread() { return true; }

    public ListenableFuture<Object> addScheduledTask(Runnable runnableToSchedule) {
        scheduled.add(runnableToSchedule);
        return null;
    }

    // harness helper
    public List<Runnable> scheduledTasks() { return scheduled; }
}
