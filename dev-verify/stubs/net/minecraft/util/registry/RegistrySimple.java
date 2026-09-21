// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util.registry;

import java.util.HashMap;
import java.util.Map;

public class RegistrySimple<K, V> {
    protected final Map<K, V> registryObjects = new HashMap<K, V>();

    public V getObject(K name) { return registryObjects.get(name); }
    public K getNameForObject(V value) {
        for (Map.Entry<K, V> e : registryObjects.entrySet()) if (e.getValue() == value) return e.getKey();
        return null;
    }
    public boolean containsKey(K name) { return registryObjects.containsKey(name); }

    // harness helper (the real registry is populated during game start-up)
    public void putObject(K name, V value) { registryObjects.put(name, value); }
}
