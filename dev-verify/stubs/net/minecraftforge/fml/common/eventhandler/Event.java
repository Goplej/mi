// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.eventhandler;

public class Event {
    private boolean canceled;

    public boolean isCancelable() { return getClass().isAnnotationPresent(Cancelable.class); }
    public boolean isCanceled() { return canceled; }

    public void setCanceled(boolean value) {
        if (!isCancelable()) {
            throw new IllegalArgumentException("Attempted to cancel a non-cancelable event: " + getClass());
        }
        this.canceled = value;
    }
}
