// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.event;

import net.minecraft.entity.player.EntityPlayerMP;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.util.text.TextComponentString;
import net.minecraftforge.fml.common.eventhandler.Cancelable;
import net.minecraftforge.fml.common.eventhandler.Event;

@Cancelable
public class ServerChatEvent extends Event {
    private final EntityPlayerMP player;
    private final String message;
    private final String username;
    private ITextComponent component;

    public ServerChatEvent(EntityPlayerMP player, String message, ITextComponent component) {
        this.player = player; this.message = message; this.component = component; this.username = player.getName();
    }

    public void setComponent(ITextComponent e) { this.component = e; }
    public ITextComponent getComponent() { return component; }
    public String getMessage() { return this.message; }
    public String getUsername() { return this.username; }
    public EntityPlayerMP getPlayer() { return this.player; }

    // harness helper
    public String broadcastText() {
        return component == null ? message : component.getUnformattedText();
    }
}
