// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.server.management;

import net.minecraft.entity.player.EntityPlayerMP;
import net.minecraft.util.text.ITextComponent;

import java.util.ArrayList;
import java.util.List;

public class PlayerList {
    private final List<EntityPlayerMP> players = new ArrayList<EntityPlayerMP>();
    private final List<String> broadcasts = new ArrayList<String>();

    public EntityPlayerMP getPlayerByUsername(String username) {
        for (EntityPlayerMP player : players) {
            if (player.getName().equals(username)) {
                return player;
            }
        }
        return null;
    }

    public List<EntityPlayerMP> getPlayers() { return players; }

    public void sendMessage(ITextComponent component) { broadcasts.add(component.getUnformattedText()); }
    public void sendMessage(ITextComponent component, boolean isSystem) { sendMessage(component); }

    // harness helpers
    public void addPlayer(EntityPlayerMP player) { players.add(player); }
    public List<String> broadcasts() { return broadcasts; }
}
