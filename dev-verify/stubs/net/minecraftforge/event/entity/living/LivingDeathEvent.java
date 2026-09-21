// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.event.entity.living;

import net.minecraft.entity.EntityLivingBase;
import net.minecraft.util.DamageSource;
import net.minecraftforge.fml.common.eventhandler.Cancelable;

@Cancelable
public class LivingDeathEvent extends LivingEvent {
    private final DamageSource source;

    public LivingDeathEvent(EntityLivingBase entity, DamageSource source) { super(entity); this.source = source; }
    public DamageSource getSource() { return source; }
}
