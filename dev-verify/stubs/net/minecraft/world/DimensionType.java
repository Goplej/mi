// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.world;

public enum DimensionType {
    OVERWORLD(0, "overworld"), NETHER(-1, "the_nether"), THE_END(1, "the_end");

    private final int id;
    private final String name;

    DimensionType(int idIn, String nameIn) { this.id = idIn; this.name = nameIn; }

    public int getId() { return id; }
    public String getName() { return name; }
}
