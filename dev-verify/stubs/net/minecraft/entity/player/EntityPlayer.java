// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity.player;

import net.minecraft.entity.EntityLivingBase;
import net.minecraft.util.FoodStats;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.List;

public class EntityPlayer extends EntityLivingBase {
    public InventoryPlayer inventory = new InventoryPlayer(this);

    private final FoodStats foodStats = new FoodStats();
    private final List<String> messages = new ArrayList<String>();
    private String playerName = "Player";

    public EntityPlayer() { }
    public EntityPlayer(World worldIn) { super(worldIn); }

    public String getName() { return playerName; }
    public FoodStats getFoodStats() { return foodStats; }

    public void sendStatusMessage(ITextComponent chatComponent, boolean actionBar) {
        messages.add((actionBar ? "[actionbar] " : "") + chatComponent.getUnformattedText());
    }

    // harness helpers
    public void setPlayerName(String name) { this.playerName = name; }
    public List<String> sentMessages() { return messages; }
}
