// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.gui;

import net.minecraft.client.Minecraft;

public class GuiButton extends Gui {
    protected int width;
    protected int height;
    public int x;
    public int y;
    public String displayString;
    public int id;
    public boolean enabled = true;
    public boolean visible = true;
    protected boolean hovered;

    public GuiButton(int buttonId, int x, int y, String buttonText) { this(buttonId, x, y, 200, 20, buttonText); }

    public GuiButton(int buttonId, int x, int y, int widthIn, int heightIn, String buttonText) {
        this.id = buttonId; this.x = x; this.y = y; this.width = widthIn; this.height = heightIn; this.displayString = buttonText;
    }

    public void drawButton(Minecraft mc, int mouseX, int mouseY, float partialTicks) { }

    // harness helpers
    public int getWidth() { return width; }
    public int getHeight() { return height; }
}
