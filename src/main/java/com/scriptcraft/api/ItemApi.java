package com.scriptcraft.api;

import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.util.ResourceLocation;

/** Read-only view of an {@link ItemStack}, e.g. {@code player.getHeldItem()}. */
public final class ItemApi {

    private final ItemStack stack;

    public ItemApi(ItemStack stack) {
        this.stack = stack;
    }

    public boolean isEmpty() {
        return stack == null || stack.isEmpty();
    }

    /** Registry name, e.g. {@code minecraft:diamond_sword}. */
    public String getName() {
        if (isEmpty()) {
            return "minecraft:air";
        }
        Item item = stack.getItem();
        ResourceLocation name = Item.REGISTRY.getNameForObject(item);
        return name == null ? "unknown" : name.toString();
    }

    /** Display name, includes renames and enchantment-free formatting. */
    public String getDisplayName() {
        return isEmpty() ? "" : stack.getDisplayName();
    }

    public int getCount() {
        return isEmpty() ? 0 : stack.getCount();
    }

    public int getMeta() {
        return isEmpty() ? 0 : stack.getItemDamage();
    }

    @Override
    public String toString() {
        return isEmpty() ? "ItemStack(air)" : "ItemStack(" + getName() + " x" + getCount() + ")";
    }
}
