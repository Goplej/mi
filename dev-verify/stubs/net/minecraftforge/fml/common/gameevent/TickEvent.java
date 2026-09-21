// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.gameevent;

import net.minecraftforge.fml.common.eventhandler.Event;
import net.minecraftforge.fml.relauncher.Side;

public class TickEvent extends Event {
    public enum Type { WORLD, PLAYER, CLIENT, SERVER, RENDER }
    public enum Phase { START, END }

    public final Type type;
    public final Side side;
    public final Phase phase;

    public TickEvent(Type type, Side side, Phase phase) { this.type = type; this.side = side; this.phase = phase; }

    public static class ServerTickEvent extends TickEvent {
        public ServerTickEvent(Phase phase) { super(Type.SERVER, Side.SERVER, phase); }
    }

    public static class ClientTickEvent extends TickEvent {
        public ClientTickEvent(Phase phase) { super(Type.CLIENT, Side.CLIENT, phase); }
    }
}
