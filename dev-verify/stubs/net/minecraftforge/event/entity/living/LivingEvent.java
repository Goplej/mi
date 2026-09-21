// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.event.entity.living;

import net.minecraft.entity.EntityLivingBase;
import net.minecraftforge.event.entity.EntityEvent;

public class LivingEvent extends EntityEvent {
    private final EntityLivingBase entityLiving;

    public LivingEvent(EntityLivingBase entity) { super(entity); this.entityLiving = entity; }
    public EntityLivingBase getEntityLiving() { return entityLiving; }
}
