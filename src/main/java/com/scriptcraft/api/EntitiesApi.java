package com.scriptcraft.api;

import com.scriptcraft.core.GameRefs;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityList;
import net.minecraft.util.ResourceLocation;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.List;

/** {@code entities} - find and spawn entities in the script's world. */
public final class EntitiesApi {

    private final WorldApi world;

    public EntitiesApi(WorldApi world) {
        this.world = world;
    }

    /** Entities within {@code radius} blocks of the given point. */
    public List<EntityApi> getNearby(double x, double y, double z, double radius) {
        return world.getEntitiesNear(x, y, z, radius);
    }

    public int count() {
        return world.getEntities().size();
    }

    /**
     * Spawns an entity by registry name, e.g. {@code entities.spawn("minecraft:cow", x, y, z)}.
     * Returns {@code null} when the name is unknown or no world is loaded.
     */
    public EntityApi spawn(String name, double x, double y, double z) {
        World world = GameRefs.worldFor(null);
        if (world == null) {
            throw new IllegalStateException("No world available. Join a world before spawning entities.");
        }
        Entity entity = EntityList.createEntityByIDFromName(new ResourceLocation(String.valueOf(name)), world);
        if (entity == null) {
            return null;
        }
        entity.setPosition(x, y, z);
        world.spawnEntity(entity);
        return new EntityApi(entity);
    }

    /** Convenience wrapper used by examples and tests. */
    public List<String> nearbyTypes(double x, double y, double z, double radius) {
        List<String> types = new ArrayList<String>();
        for (EntityApi entity : world.getEntitiesNear(x, y, z, radius)) {
            types.add(entity.getType());
        }
        return types;
    }
}
