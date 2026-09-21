// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util.text;

public class TextComponentString implements ITextComponent {
    private final String text;

    public TextComponentString(String msg) {
        this.text = msg;
    }

    public ITextComponent appendText(String text) { return this; }
    public ITextComponent appendSibling(ITextComponent component) { return this; }
    public ITextComponent setStyle(Style style) { return this; }
    public String getUnformattedText() { return text; }
    public String toString() { return text; }
}
