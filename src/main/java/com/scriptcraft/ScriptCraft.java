package com.scriptcraft;

import com.scriptcraft.commands.ScriptCommand;
import com.scriptcraft.core.GameRefs;
import com.scriptcraft.core.Reference;
import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.core.ScriptCraftLog;
import com.scriptcraft.engine.ScriptEngineManager;
import com.scriptcraft.engine.TimerScheduler;
import com.scriptcraft.events.EventBridge;
import com.scriptcraft.events.ScriptEventRegistry;
import com.scriptcraft.filesystem.ScriptDirectories;
import com.scriptcraft.filesystem.ScriptFileManager;
import com.scriptcraft.security.ScriptSandbox;
import com.scriptcraft.server.CommonProxy;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.Mod.EventHandler;
import net.minecraftforge.fml.common.Mod.Instance;
import net.minecraftforge.fml.common.SidedProxy;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import net.minecraftforge.fml.common.event.FMLServerStartingEvent;
import net.minecraftforge.fml.common.event.FMLServerStoppedEvent;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;

/**
 * ScriptCraft - JavaScript scripting for Minecraft Forge 1.12.2.
 *
 * <p>Startup order:
 * <ol>
 *   <li>preInit - create {@code .minecraft/scriptcraft}, load config, install the sandbox,
 *       check the JavaScript engine, drop the example scripts in place</li>
 *   <li>init - register the Forge event bridge and the client proxy (key binding)</li>
 *   <li>serverStarting - register {@code /script} and optionally auto-load scripts</li>
 *   <li>serverStopped - stop every script so no listener or timer survives the server</li>
 * </ol>
 */
@Mod(modid = Reference.MOD_ID, name = Reference.NAME, version = Reference.VERSION,
        acceptableRemoteVersions = "*", acceptedMinecraftVersions = "[1.12.2]")
public class ScriptCraft {

    /** Bundled with the jar and copied into scriptcraft/scripts on first start. */
    private static final String[] EXAMPLES = {
            "example.js", "welcome.js", "events.js", "timer.js", "blocks.js", "test.js"
    };

    @Instance(Reference.MOD_ID)
    public static ScriptCraft instance;

    @SidedProxy(clientSide = Reference.CLIENT_PROXY, serverSide = Reference.COMMON_PROXY)
    public static CommonProxy proxy;

    private final ScriptEventRegistry registry = new ScriptEventRegistry();
    private final TimerScheduler timers = new TimerScheduler();
    private final ScriptEngineManager engine = new ScriptEngineManager(timers, registry);

    public static ScriptEngineManager engine() {
        return instance.engine;
    }

    public static ScriptEventRegistry registry() {
        return instance.registry;
    }

    public static TimerScheduler timers() {
        return instance.timers;
    }

    @EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        ScriptCraftLog.info("Initializing...");

        File gameDir = event.getModConfigurationDirectory().getParentFile();
        ScriptDirectories.init(gameDir);

        ScriptCraftConfig.load(ScriptDirectories.configFile());
        ScriptCraftLog.setFileLogging(ScriptCraftConfig.fileLogging);
        ScriptCraftLog.setLogFile(ScriptDirectories.logFile());
        // Logged after the file appender exists, so it lands in the log file as well as the console.
        ScriptCraftLog.info("Scripts directory: " + ScriptDirectories.scripts().getAbsolutePath());

        ScriptSandbox.install();

        String engineName = checkEngine();
        ScriptCraftLog.info("Script engine initialized" + (engineName == null ? "" : " (" + engineName + ")"));

        copyExamples();
    }

    @EventHandler
    public void init(FMLInitializationEvent event) {
        MinecraftForge.EVENT_BUS.register(new EventBridge(registry, timers));
        proxy.init();
        ScriptCraftLog.info("ScriptCraft loaded successfully!");
    }

    @EventHandler
    public void serverStarting(FMLServerStartingEvent event) {
        event.registerServerCommand(new ScriptCommand(engine, registry));
        timers.reset();
        if (ScriptCraftConfig.autoLoadOnServerStart) {
            int started = 0;
            for (String name : ScriptFileManager.listScripts()) {
                if (engine.run(name, null).isSuccess()) {
                    started++;
                }
            }
            ScriptCraftLog.info("Auto-loaded " + started + " script(s)");
        }
    }

    @EventHandler
    public void serverStopped(FMLServerStoppedEvent event) {
        engine.stopAll();
        timers.reset();
        registry.clear();
        ScriptCraftLog.info("All scripts stopped");
    }

    /** Verifies that a JavaScript engine really is available before anything depends on it. */
    private String checkEngine() {
        String engineName = engine.probeEngine();
        if (engineName == null) {
            ScriptCraftLog.warn("ScriptCraft will start, but scripts cannot run without a JavaScript engine");
        }
        return engineName;
    }

    private void copyExamples() {
        if (!ScriptCraftConfig.copyExamples) {
            return;
        }
        File scriptsDir = ScriptDirectories.scripts();
        for (String name : EXAMPLES) {
            File target = new File(scriptsDir, name);
            if (target.isFile()) {
                continue;
            }
            InputStream in = ScriptCraft.class.getResourceAsStream("/assets/scriptcraft/examples/" + name);
            if (in == null) {
                ScriptCraftLog.warn("Bundled example is missing from the jar: " + name);
                continue;
            }
            try {
                ScriptFileManager.copyStream(in, target);
                ScriptCraftLog.info("Created example script: " + name);
            } catch (IOException e) {
                ScriptCraftLog.warn("Could not create " + name + ": " + e.getMessage());
            } finally {
                close(in);
            }
        }
    }

    private static void close(InputStream in) {
        try {
            in.close();
        } catch (IOException ignored) {
            // nothing useful to do here
        }
    }

    /** Convenience for client code that needs to know where it is running. */
    public static boolean isClient() {
        return GameRefs.isClientJvm();
    }
}
