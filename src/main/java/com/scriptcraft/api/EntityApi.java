package com.scriptcraft.api;

import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityList;
import net.minecraft.entity.EntityLivingBase;

/** Read-only view of any entity, with {@link #remove()} as the only mutation. */
public final class EntityApi {

    private final Entity entity;

    public EntityApi(Entity entity) {
        this.entity = entity;
    }

    public boolean isValid() {
        return entity != null;
    }

    /** Custom name tag when set, otherwise the entity type. */
    public String getName() {
        if (entity == null) {
            return "";
        }
        String custom = entity.getCustomNameTag();
        if (custom != null && !custom.isEmpty()) {
            return custom;
        }
        return getType();
    }

    /** Registry name of the entity type, e.g. {@code minecraft:zombie}. */
    public String getType() {
        if (entity == null) {
            return "";
        }
        String name = EntityList.getEntityString(entity);
        return name == null ? "unknown" : name;
    }

    public int getId() {
        return entity == null ? -1 : entity.getEntityId();
    }

    public double getX() {
        return entity == null ? 0D : entity.posX;
    }

    public double getY() {
        return entity == null ? 0D : entity.posY;
    }

    public double getZ() {
        return entity == null ? 0D : entity.posZ;
    }

    /** Current health, or -1 for entities that have none (items, minecarts, ...). */
    public double getHealth() {
        if (entity instanceof EntityLivingBase) {
            return ((EntityLivingBase) entity).getHealth();
        }
        return -1D;
    }

    public boolean isAlive() {
        return entity != null && !entity.isDead;
    }

    public int getDimension() {
        return entity == null ? 0 : entity.dimension;
    }

    public void teleport(double x, double y, double z) {
        if (entity != null) {
            entity.setPositionAndUpdate(x, y, z);
        }
    }

    public void remove() {
        if (entity != null) {
            entity.setDead();
        }
    }

    @Override
    public String toString() {
        return "Entity(" + getType() + "#" + getId() + ")";
    }
}
