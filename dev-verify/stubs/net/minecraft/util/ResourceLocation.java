// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util;

public class ResourceLocation {
    private final String namespace;
    private final String path;

    public ResourceLocation(String resourceName) {
        int split = resourceName.indexOf(':');
        this.namespace = split < 0 ? "minecraft" : resourceName.substring(0, split);
        this.path = split < 0 ? resourceName : resourceName.substring(split + 1);
    }

    public ResourceLocation(String namespaceIn, String pathIn) {
        this.namespace = namespaceIn;
        this.path = pathIn;
    }

    public String getResourceDomain() { return namespace; }
    public String getResourcePath() { return path; }
    public String toString() { return namespace + ":" + path; }

    public boolean equals(Object o) { return o instanceof ResourceLocation && toString().equals(o.toString()); }
    public int hashCode() { return toString().hashCode(); }
}
