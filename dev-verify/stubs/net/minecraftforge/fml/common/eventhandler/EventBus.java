// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.eventhandler;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * Minimal stand-in for the Forge event bus: it dispatches posted events to every
 * {@link SubscribeEvent} method whose parameter accepts the event type. Enough to exercise the
 * real EventBridge wiring in tests.
 */
public class EventBus {
    private final List<Object> targets = new ArrayList<Object>();
    private final List<Object> posted = new ArrayList<Object>();

    public void register(Object target) { targets.add(target); }
    public void unregister(Object object) { targets.remove(object); }

    public boolean post(Event event) {
        posted.add(event);
        for (Object target : new ArrayList<Object>(targets)) {
            for (Method method : target.getClass().getMethods()) {
                if (!method.isAnnotationPresent(SubscribeEvent.class) || method.getParameterTypes().length != 1) {
                    continue;
                }
                if (!method.getParameterTypes()[0].isAssignableFrom(event.getClass())) {
                    continue;
                }
                try {
                    method.invoke(target, event);
                } catch (ReflectiveOperationException e) {
                    throw new RuntimeException("Event dispatch failed for " + method, e.getCause() == null ? e : e.getCause());
                }
            }
        }
        return event.isCanceled();
    }

    // harness helpers
    public int listenerCount() { return targets.size(); }
    public List<Object> postedEvents() { return posted; }
}
