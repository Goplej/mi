// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity;

import net.minecraft.item.ItemStack;
import net.minecraft.world.World;

public class EntityLivingBase extends Entity {
    private float health = 20.0F;
    private float maxHealth = 20.0F;
    private ItemStack held = ItemStack.EMPTY;

    public EntityLivingBase() { }
    public EntityLivingBase(World worldIn) { super(worldIn); }

    public final float getHealth() { return health; }
    public void setHealth(float health) { this.health = health; }
    public final float getMaxHealth() { return maxHealth; }
    public ItemStack getHeldItemMainhand() { return held; }

    // harness helpers
    public void setMaxHealth(float value) { this.maxHealth = value; }
    public void setHeldItem(ItemStack stack) { this.held = stack; }
}
