// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.settings;

public class KeyBinding {
    private final String description;
    private final int keyCode;
    private final String category;
    private boolean pressed;

    public KeyBinding(String description, int keyCode, String category) {
        this.description = description; this.keyCode = keyCode; this.category = category;
    }

    public boolean isKeyDown() { return pressed; }
    public boolean isPressed() { return pressed; }
    public int getKeyCode() { return keyCode; }
    public String getKeyCategory() { return category; }
    public String getKeyDescription() { return description; }

    // harness helper
    public void setPressed(boolean value) { this.pressed = value; }
}
