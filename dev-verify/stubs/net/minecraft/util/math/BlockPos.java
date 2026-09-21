// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util.math;

import net.minecraft.entity.Entity;

public class BlockPos extends Vec3i {
    public BlockPos(int x, int y, int z) { super(x, y, z); }
    public BlockPos(double x, double y, double z) { super((int) x, (int) y, (int) z); }
    public BlockPos(Entity source) { super(0, 0, 0); }
}
