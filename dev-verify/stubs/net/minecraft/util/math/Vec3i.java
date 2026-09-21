// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util.math;

public class Vec3i implements Comparable<Vec3i> {
    private final int x, y, z;

    public Vec3i(int xIn, int yIn, int zIn) { this.x = xIn; this.y = yIn; this.z = zIn; }
    public int getX() { return x; }
    public int getY() { return y; }
    public int getZ() { return z; }
    public int compareTo(Vec3i other) { return 0; }

    public boolean equals(Object o) {
        return o instanceof Vec3i && ((Vec3i) o).x == x && ((Vec3i) o).y == y && ((Vec3i) o).z == z;
    }
    public int hashCode() { return (y + z * 31) * 31 + x; }
    public String toString() { return x + "," + y + "," + z; }
}
