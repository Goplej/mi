// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.client.gui;

import java.util.ArrayList;
import java.util.List;

public class FontRenderer {
    public int FONT_HEIGHT = 9;

    public int drawString(String text, int x, int y, int color) { return x + getStringWidth(text); }
    public int drawString(String text, float x, float y, int color, boolean dropShadow) { return (int) x + getStringWidth(text); }
    public int drawStringWithShadow(String text, float x, float y, int color) { return (int) x + getStringWidth(text); }
    public int getStringWidth(String text) { return text == null ? 0 : text.length() * 6; }

    public String trimStringToWidth(String text, int width) { return trimStringToWidth(text, width, false); }

    public String trimStringToWidth(String text, int width, boolean reverse) {
        if (text == null) {
            return "";
        }
        int max = Math.max(0, width / 6);
        return text.length() <= max ? text : text.substring(0, max);
    }

    public List<String> listFormattedStringToWidth(String str, int wrapWidth) {
        List<String> lines = new ArrayList<String>();
        lines.add(str);
        return lines;
    }
}
