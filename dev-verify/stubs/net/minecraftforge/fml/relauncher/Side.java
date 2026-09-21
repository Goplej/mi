// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.relauncher;

public enum Side {
    CLIENT, SERVER;

    public boolean isClient() { return this == CLIENT; }
    public boolean isServer() { return this == SERVER; }
}
