// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.world;

public class WorldProvider {
    private DimensionType type = DimensionType.OVERWORLD;

    public DimensionType getDimensionType() { return type; }

    // harness helper
    public void setDimensionType(DimensionType typeIn) { this.type = typeIn; }
}
