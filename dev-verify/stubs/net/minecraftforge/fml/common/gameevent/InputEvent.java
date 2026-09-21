// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.gameevent;

import net.minecraftforge.fml.common.eventhandler.Event;

public class InputEvent extends Event {
    public static class KeyInputEvent extends InputEvent {
    }

    public static class MouseInputEvent extends InputEvent {
    }
}
