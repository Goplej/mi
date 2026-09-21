package com.scriptcraft.api;

/**
 * {@code blocks} - shortcuts for the block operations scripts do most, plus block name/id lookup.
 * Coordinates work like {@code world.setBlock}: they are floored to the block grid.
 */
public final class BlocksApi {

    private final WorldApi world;

    public BlocksApi(WorldApi world) {
        this.world = world;
    }

    public BlockInfo get(double x, double y, double z) {
        return world.getBlock(x, y, z);
    }

    public boolean set(double x, double y, double z, String blockName) {
        return world.setBlock(x, y, z, blockName);
    }

    public boolean set(double x, double y, double z, String blockName, int meta) {
        return world.setBlock(x, y, z, blockName, meta);
    }

    /** Just the registry name, e.g. {@code "minecraft:stone"}. */
    public String nameAt(double x, double y, double z) {
        return world.getBlock(x, y, z).getName();
    }

    public boolean isAir(double x, double y, double z) {
        return world.isAir(x, y, z);
    }

    /** Numeric block id used by 1.12.2, or -1 when the name is unknown. */
    public int idOf(String blockName) {
        return BlockLookup.idOf(blockName);
    }

    public boolean exists(String blockName) {
        return BlockLookup.exists(blockName);
    }
}
