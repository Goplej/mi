package com.scriptcraft.api;

/** Immutable description of a block, returned by {@code world.getBlock(x, y, z)}. */
public final class BlockInfo {

    private final String name;
    private final int meta;
    private final int x;
    private final int y;
    private final int z;

    public BlockInfo(String name, int meta, int x, int y, int z) {
        this.name = name;
        this.meta = meta;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /** Registry name, e.g. {@code minecraft:stone}. */
    public String getName() {
        return name;
    }

    public int getMeta() {
        return meta;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public int getZ() {
        return z;
    }

    public boolean isAir() {
        return "minecraft:air".equals(name);
    }

    @Override
    public String toString() {
        return name + (meta == 0 ? "" : ":" + meta) + " @ " + x + "," + y + "," + z;
    }
}
