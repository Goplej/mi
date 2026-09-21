package com.scriptcraft.api;

import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.engine.TimerScheduler;
import com.scriptcraft.events.ScriptEventRegistry;
import net.minecraft.entity.player.EntityPlayer;

import javax.script.ScriptEngine;

/**
 * Installs the JavaScript API into a fresh script context.
 *
 * <p>Adding a new global means adding one line here - that is the whole extension point for the
 * scripting API.
 */
public final class ScriptBindings {

    /**
     * Names of every global a script can use. The IDE shows them as a hint on an empty file, and
     * a future autocomplete reads the same list - adding a global here keeps both in sync.
     */
    public static final String[] GLOBALS = {
            "player", "world", "server", "blocks", "entities", "events", "timer", "console", "scriptcraft"
    };

    private ScriptBindings() {
    }

    public static void install(ScriptContext context, Object owner, ScriptEventRegistry registry, TimerScheduler timers) {
        ScriptEngine engine = context.getEngine();
        EntityPlayer player = owner instanceof EntityPlayer ? (EntityPlayer) owner : null;
        WorldApi world = new WorldApi(player);

        engine.put("player", new PlayerApi(player, context.getName()));
        engine.put("world", world);
        engine.put("server", new ServerApi(timers));
        engine.put("blocks", new BlocksApi(world));
        engine.put("entities", new EntitiesApi(world));
        engine.put("events", new EventsApi(context, registry));
        engine.put("timer", new TimerApi(context, timers));
        engine.put("console", new ConsoleApi(context));
        engine.put("scriptcraft", new InfoApi(context));
    }
}
