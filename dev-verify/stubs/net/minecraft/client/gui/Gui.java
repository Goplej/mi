// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.gui;

public class Gui {
    protected float zLevel;
    public static int drawCalls;

    public static void drawRect(int left, int top, int right, int bottom, int color) { drawCalls++; }
}
