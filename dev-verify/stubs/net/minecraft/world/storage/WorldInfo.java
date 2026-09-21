// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.world.storage;

public class WorldInfo {
    private String worldName = "world";

    public String getWorldName() { return worldName; }

    // harness helper
    public void setWorldName(String name) { this.worldName = name; }
}
