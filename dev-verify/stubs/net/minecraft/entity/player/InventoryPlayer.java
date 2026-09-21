// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity.player;

import net.minecraft.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

public class InventoryPlayer {
    private final EntityPlayer player;
    private final List<ItemStack> added = new ArrayList<ItemStack>();

    public InventoryPlayer(EntityPlayer playerIn) { this.player = playerIn; }

    public boolean addItemStackToInventory(ItemStack itemStackIn) {
        if (itemStackIn == null || itemStackIn.isEmpty()) {
            return false;
        }
        added.add(itemStackIn);
        return true;
    }

    // harness helper
    public List<ItemStack> addedItems() { return added; }
}
