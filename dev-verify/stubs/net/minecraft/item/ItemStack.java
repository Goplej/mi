// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.item;

import net.minecraft.block.Block;
import net.minecraft.util.text.ITextComponent;
import net.minecraft.util.text.TextComponentString;

public class ItemStack {
    private final Item item;
    private final int count;
    private final int damage;

    public ItemStack(Block blockIn) { this(new Item("minecraft:air"), 1, 0); }
    public ItemStack(Block blockIn, int amount) { this(new Item("minecraft:air"), amount, 0); }
    public ItemStack(Block blockIn, int amount, int meta) { this(new Item("minecraft:air"), amount, meta); }
    public ItemStack(Item itemIn) { this(itemIn, 1, 0); }
    public ItemStack(Item itemIn, int amount) { this(itemIn, amount, 0); }
    public ItemStack(Item itemIn, int amount, int meta) {
        this.item = itemIn; this.count = amount; this.damage = meta;
    }

    public static final ItemStack EMPTY = new ItemStack(new Item("minecraft:air"), 0, 0);

    public boolean isEmpty() { return item == null || count <= 0; }
    public Item getItem() { return item; }
    public String getDisplayName() { return item == null ? "" : item.getUnlocalizedName(); }
    public int getCount() { return count; }
    public int getItemDamage() { return damage; }
    public ITextComponent getTextComponent() { return new TextComponentString(getDisplayName()); }
}
