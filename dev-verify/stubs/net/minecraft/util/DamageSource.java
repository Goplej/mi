// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util;

public class DamageSource {
    private final String type;

    public DamageSource(String damageTypeIn) { this.type = damageTypeIn; }
    public String getDamageType() { return type; }
}
