// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util.registry;

import net.minecraft.util.ResourceLocation;

public class RegistryNamespaced<K extends ResourceLocation, V> extends RegistrySimple<K, V> {
    public int getIDForObject(V value) { return 0; }
    public V getObjectById(int id) { return null; }
}
