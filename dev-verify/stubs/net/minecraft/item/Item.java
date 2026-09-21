// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.item;

import net.minecraft.util.ResourceLocation;
import net.minecraft.util.registry.RegistryNamespaced;

public class Item {
    public static final RegistryNamespaced<ResourceLocation, Item> REGISTRY =
            new RegistryNamespaced<ResourceLocation, Item>();

    private final String name;

    public Item(String registryName) { this.name = registryName; }

    public static Item register(String registryName) {
        Item item = new Item(registryName);
        REGISTRY.putObject(new ResourceLocation(registryName), item);
        return item;
    }

    public String getUnlocalizedName() { return name; }
    public String toString() { return name; }
}
