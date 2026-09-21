// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.gui;

import net.minecraft.client.Minecraft;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class GuiScreen extends Gui {
    protected Minecraft mc = Minecraft.getMinecraft();
    public int width = 854;
    public int height = 480;
    protected List<GuiButton> buttonList = new ArrayList<GuiButton>();

    protected <T extends GuiButton> T addButton(T buttonIn) { buttonList.add(buttonIn); return buttonIn; }

    public void initGui() { }
    public void drawScreen(int mouseX, int mouseY, float partialTicks) { }
    public void drawDefaultBackground() { }
    public void updateScreen() { }
    public void handleInput() throws IOException { }
    public void handleMouseInput() throws IOException { }
    public void onGuiClosed() { }
    public boolean doesGuiPauseGame() { return true; }
    protected void keyTyped(char typedChar, int keyCode) throws IOException { }
    protected void mouseClicked(int mouseX, int mouseY, int mouseButton) throws IOException { }
    protected void actionPerformed(GuiButton button) throws IOException { }
    public static boolean ctrlDown;
    public static boolean shiftDown;

    public static boolean isCtrlKeyDown() { return ctrlDown; }
    public static boolean isShiftKeyDown() { return shiftDown; }
}
