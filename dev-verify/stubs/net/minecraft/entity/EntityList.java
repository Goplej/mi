// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.entity;

import net.minecraft.util.ResourceLocation;
import net.minecraft.world.World;

public final class EntityList {
    private EntityList() {
    }

    public static String getEntityString(Entity entityIn) {
        return entityIn == null ? null : entityIn.getName();
    }

    public static Entity createEntityByIDFromName(ResourceLocation name, World worldIn) {
        Entity entity = new Entity(worldIn);
        entity.setTypeName(name == null ? "unknown" : name.toString());
        return entity;
    }
}
