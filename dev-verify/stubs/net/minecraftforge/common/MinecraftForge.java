// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.common;

import net.minecraftforge.fml.common.eventhandler.EventBus;

public class MinecraftForge {
    public static final EventBus EVENT_BUS = new EventBus();
}
