// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.network;

import net.minecraft.util.text.ITextComponent;

public class NetHandlerPlayServer {
    private ITextComponent disconnectReason;

    public void disconnect(final ITextComponent textComponent) { this.disconnectReason = textComponent; }

    // harness helper
    public ITextComponent disconnectReason() { return disconnectReason; }
}
