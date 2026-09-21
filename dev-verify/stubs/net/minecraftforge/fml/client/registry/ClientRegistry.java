// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.client.registry;

import net.minecraft.client.settings.KeyBinding;

import java.util.ArrayList;
import java.util.List;

public class ClientRegistry {
    private static final List<KeyBinding> KEY_BINDINGS = new ArrayList<KeyBinding>();

    public static void registerKeyBinding(KeyBinding key) { KEY_BINDINGS.add(key); }

    // harness helper
    public static List<KeyBinding> registeredKeys() { return KEY_BINDINGS; }
}
