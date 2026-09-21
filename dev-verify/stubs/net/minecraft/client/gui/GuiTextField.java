// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.gui;

public class GuiTextField {
    private final int id;
    private final int x;
    private final int y;
    private final int width;
    private final int height;
    private String text = "";
    private int cursorPosition;
    private boolean focused;
    private boolean visible = true;
    private int maxStringLength = 32;

    public GuiTextField(int componentId, FontRenderer fontrendererObj, int x, int y, int par5Width, int par6Height) {
        this.id = componentId;
        this.x = x;
        this.y = y;
        this.width = par5Width;
        this.height = par6Height;
    }

    public void setText(String textIn) { this.text = textIn == null ? "" : textIn; this.cursorPosition = text.length(); }
    public String getText() { return text; }
    public void setMaxStringLength(int length) { this.maxStringLength = length; }
    public void setFocused(boolean isFocusedIn) { this.focused = isFocusedIn; }
    public boolean isFocused() { return focused; }
    public void setVisible(boolean isVisible) { this.visible = isVisible; }
    public boolean getVisible() { return visible; }
    public int getCursorPosition() { return cursorPosition; }
    public void setCursorPosition(int pos) { this.cursorPosition = pos; }
    public int getWidth() { return 100; }
    public void updateCursorCounter() { }
    public void drawTextBox() { }

    public boolean textboxKeyTyped(char typedChar, int keyCode) {
        if (keyCode == 14) {
            if (!text.isEmpty()) {
                text = text.substring(0, text.length() - 1);
            }
            return true;
        }
        if (typedChar >= ' ' && text.length() < maxStringLength) {
            text = text + typedChar;
            cursorPosition = text.length();
            return true;
        }
        return false;
    }

    public boolean mouseClicked(int mouseX, int mouseY, int mouseButton) {
        boolean inside = visible && mouseButton == 0
                && mouseX >= x && mouseX < x + width && mouseY >= y && mouseY < y + height;
        focused = inside;
        if (inside) {
            cursorPosition = Math.min(text.length(), Math.max(0, (mouseX - x) / 6));
        }
        return inside;
    }
}
