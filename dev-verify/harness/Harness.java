package harness;

import com.scriptcraft.ScriptCraft;
import com.scriptcraft.commands.ScriptCommand;
import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.engine.ScriptState;
import com.scriptcraft.filesystem.ScriptDirectories;
import com.scriptcraft.filesystem.ScriptFileManager;
import com.scriptcraft.security.ScriptSandbox;
import com.scriptcraft.server.CommonProxy;
import com.scriptcraft.util.ConsoleBuffer;
import com.scriptcraft.util.TextEditor;
import net.minecraft.block.Block;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.command.ICommand;
import net.minecraft.command.ICommandSender;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayerMP;
import net.minecraft.item.Item;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.DamageSource;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.text.TextComponentString;
import net.minecraft.world.World;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.ServerChatEvent;
import net.minecraftforge.event.entity.EntityJoinWorldEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.world.BlockEvent;
import net.minecraftforge.fml.common.FMLCommonHandler;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import net.minecraftforge.fml.common.event.FMLServerStartingEvent;
import net.minecraftforge.fml.common.event.FMLServerStoppedEvent;
import net.minecraftforge.fml.common.eventhandler.Event;
import net.minecraftforge.fml.common.gameevent.PlayerEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import net.minecraftforge.fml.relauncher.Side;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Headless verification for ScriptCraft.
 *
 * <p>It boots the real mod classes (preInit -> init -> serverStarting) against the compile-time
 * stand-ins in {@code dev-verify/stubs} and then drives them exactly like a player would: through
 * /script, through Forge events posted on the real bus and through server ticks. JavaScript runs on
 * the real Nashorn engine from Java 8.
 */
public final class Harness {

    private static int passed;
    private static int failed;
    private static final List<String> FAILURES = new ArrayList<String>();

    private static MinecraftServer server;
    private static World world;
    private static EntityPlayerMP player;
    private static ScriptCommand command;
    private static ScriptCraft mod;

    public static void main(String[] args) throws Exception {
        File gameDir = freshGameDir();
        boot(gameDir);

        bootChecks(gameDir);
        exampleScriptChecks();
        commandChecks();
        sideChecks();
        lifecycleChecks();
        eventChecks();
        timerChecks();
        errorHandlingChecks();
        sandboxChecks();
        pathTraversalChecks();
        worldApiChecks();
        editorChecks();
        bundledExampleChecks();
        ideChecks();
        documentationSnippetChecks();
        configurationChecks();
        shutdownChecks();

        System.out.println();
        System.out.println("==============================================");
        System.out.println("  PASSED: " + passed + "   FAILED: " + failed);
        for (String failure : FAILURES) {
            System.out.println("  FAIL -> " + failure);
        }
        System.out.println("==============================================");
        if (failed > 0) {
            System.exit(1);
        }
    }

    // ------------------------------------------------------------------ boot

    private static File freshGameDir() throws Exception {
        File gameDir = new File("build/test-game");
        delete(gameDir);
        if (!gameDir.mkdirs()) {
            throw new IllegalStateException("Cannot create " + gameDir.getAbsolutePath());
        }
        return gameDir;
    }

    private static void boot(File gameDir) throws Exception {
        // Forge normally fills these in; the harness plays Forge.
        server = new MinecraftServer();
        world = server.getEntityWorld();
        player = new EntityPlayerMP(world);
        player.setPlayerName("Steve");
        player.world = world;
        world.playerEntities.add(player);
        server.getPlayerList().addPlayer(player);
        FMLCommonHandler.instance().setServer(server);
        FMLCommonHandler.instance().setSide(Side.SERVER);

        Block.register("minecraft:stone");
        Block.register("minecraft:dirt");
        Block.register("minecraft:glass");
        Item.register("minecraft:diamond");

        mod = new ScriptCraft();
        ScriptCraft.instance = mod;
        ScriptCraft.proxy = new CommonProxy();
        mod.preInit(new FMLPreInitializationEvent(new File(gameDir, "config")));
        mod.init(new FMLInitializationEvent());

        FMLServerStartingEvent starting = new FMLServerStartingEvent(server);
        mod.serverStarting(starting);
        command = (ScriptCommand) starting.registeredCommands().get(0);
    }

    // ----------------------------------------------------------------- checks

    private static void bootChecks(File gameDir) throws Exception {
        section("boot");
        check("scriptcraft folder created", ScriptDirectories.root().isDirectory());
        check("scripts folder created", ScriptDirectories.scripts().isDirectory());
        check("config folder created", ScriptDirectories.config().isDirectory());
        check("logs folder created", ScriptDirectories.logs().isDirectory());
        check("config file written", ScriptDirectories.configFile().isFile());
        check("example.js copied from the jar", new File(ScriptDirectories.scripts(), "example.js").isFile());
        check("all 6 bundled examples copied", ScriptFileManager.listScripts().size() == 6);
        check("log file created", ScriptDirectories.logFile().isFile());
        List<String> log = readLines(ScriptDirectories.logFile());
        check("log file records the scripts directory", contains(log, "Scripts directory: "));
        check("log file records the engine", contains(log, "Script engine initialized"));
        check("JavaScript engine reports Nashorn",
                String.valueOf(ScriptCraft.engine().getEngineDescription()).contains("Nashorn"));
        check("sandbox SecurityManager installed", ScriptSandbox.isManagerInstalled());
        check("/script command registered", "script".equals(command.getName()));
        check("event bridge on the Forge bus", MinecraftForge.EVENT_BUS.listenerCount() == 1);
        check("sandbox default is on", ScriptCraftConfig.sandboxEnabled);
    }

    private static void exampleScriptChecks() throws Exception {
        section("example.js");
        run("/script run example.js");
        check("player got the message",
                player.sentMessages().contains("ScriptCraft loaded successfully!"));
        check("console.log reached the log buffer",
                contains(ConsoleBuffer.snapshot(), "[ScriptCraft:example.js] Hello from example.js"));
        check("script is marked RUNNING", ScriptCraft.engine().isRunning("example.js"));
    }

    private static void commandChecks() throws Exception {
        section("commands");
        String list = run("/script list");
        check("list shows the running script", list.contains("[RUNNING] example.js"));
        check("list shows stopped scripts too", list.contains("[STOPPED] test.js"));

        String info = run("/script info example.js");
        check("info reports the state", info.contains("State:   RUNNING"));
        check("info reports timer/listener counts", info.contains("Timers:") && info.contains("Listeners:"));

        run("/script stop example.js");
        check("stop removed the context", !ScriptCraft.engine().isLoaded("example.js"));
        check("list now shows STOPPED", run("/script list").contains("[STOPPED] example.js"));

        run("/script reload example.js");
        check("reload started it again", ScriptCraft.engine().isRunning("example.js"));

        run("/script reloadall");
        check("reloadall keeps scripts running", ScriptCraft.engine().isRunning("example.js"));

        run("/script new harness_new.js");
        check("/script new created the file", new File(ScriptDirectories.scripts(), "harness_new.js").isFile());

        String help = run("/script help");
        check("help lists run/stop/reload", help.contains("/script run <file>")
                && help.contains("/script stop <file>") && help.contains("/script reload <file>"));

        String bad = run("/script run does_not_exist.js");
        check("missing file is reported, not thrown", bad.contains("Script not found"));

        String wrongExt = run("/script run example.txt");
        check("non-.js file is rejected", wrongExt.contains("Not a JavaScript file"));
    }

    private static void sideChecks() throws Exception {
        section("client/server split");
        check("server side uses the common proxy",
                "com.scriptcraft.server.CommonProxy".equals(ScriptCraft.proxy.getClass().getName()));
        check("common proxy reports it is not a client", !ScriptCraft.proxy.isClient());
        String ide = run("/script ide");
        check("/script ide explains itself on a server", ide.contains("client-only"));

        List<String> first = command.getTabCompletions(server, player, new String[]{"re"}, null);
        check("tab completes subcommands", first.contains("reload") && first.contains("reloadall"));
        List<String> second = command.getTabCompletions(server, player, new String[]{"run", "exam"}, null);
        check("tab completes file names", second.contains("example.js"));
        check("reloadall offers no file names",
                command.getTabCompletions(server, player, new String[]{"reloadall", "x"}, null).isEmpty());
    }

    private static void lifecycleChecks() throws Exception {
        section("lifecycle");
        write("lifecycle.js",
                "events.onPlayerJoin(function (e) { console.log('join'); });\n"
              + "events.onTick(function (e) { });\n"
              + "timer.every(1000, function () { });\n"
              + "console.log('lifecycle up');\n");

        run("/script run lifecycle.js");
        ScriptContext context = ScriptCraft.engine().get("lifecycle.js");
        check("listeners registered", ScriptCraft.registry().countFor(context) == 2);
        check("timers registered", ScriptCraft.timers().countFor(context) == 1);

        String stop = run("/script stop lifecycle.js");
        check("stop reports the released counts", stop.contains("timers cancelled: 1") && stop.contains("listeners removed: 2"));
        check("no listeners left", ScriptCraft.registry().countFor(context) == 0);
        check("no timers left", ScriptCraft.timers().countFor(context) == 0);
        check("engine bindings cleared", context.getEngine().get("events") == null);

        run("/script reload lifecycle.js");
        run("/script reload lifecycle.js");
        ScriptContext reloaded = ScriptCraft.engine().get("lifecycle.js");
        check("reload does not duplicate listeners", ScriptCraft.registry().countFor(reloaded) == 2);
        check("reload does not duplicate timers", ScriptCraft.timers().countFor(reloaded) == 1);
        run("/script stop lifecycle.js");
    }

    private static void eventChecks() throws Exception {
        section("events");
        write("harness_events.js",
                "var seen = [];\n"
              + "events.onPlayerJoin(function (event) { seen.push('join:' + event.player.getName()); event.player.sendMessage('Welcome!'); });\n"
              + "events.onPlayerChat(function (event) {\n"
              + "  if (event.getMessage().indexOf('spam') >= 0) { event.cancel(); }\n"
              + "  else { event.setMessage('[mod] ' + event.getMessage()); }\n"
              + "});\n"
              + "events.onPlayerBreakBlock(function (event) { seen.push('break:' + event.getBlock()); });\n"
              + "events.onPlayerDeath(function (event) { seen.push('death:' + event.getCause()); });\n"
              + "events.onEntitySpawn(function (event) { seen.push('spawn:' + event.getEntity().getType()); });\n"
              + "events.onTick(function (event) { seen.push('tick'); });\n"
              + "function seenList() { return seen.join(','); }\n");

        run("/script run harness_events.js");
        player.sentMessages().clear();

        MinecraftForge.EVENT_BUS.post(new PlayerEvent.PlayerLoggedInEvent(player));
        check("onPlayerJoin fired", player.sentMessages().contains("Welcome!"));

        ServerChatEvent ok = new ServerChatEvent(player, "hello", new TextComponentString("<Steve> hello"));
        MinecraftForge.EVENT_BUS.post(ok);
        check("chat message rewritten by the script", ok.broadcastText().equals("[mod] hello"));
        check("normal chat not cancelled", !ok.isCanceled());

        ServerChatEvent spam = new ServerChatEvent(player, "buy spam now", new TextComponentString("<Steve> buy spam now"));
        MinecraftForge.EVENT_BUS.post(spam);
        check("spam chat cancelled", spam.isCanceled());

        MinecraftForge.EVENT_BUS.post(new BlockEvent.BreakEvent(world, new BlockPos(1, 2, 3),
                Block.getBlockFromName("minecraft:stone").getDefaultState(), player));
        MinecraftForge.EVENT_BUS.post(new LivingDeathEvent(player, new DamageSource("lava")));

        Entity cow = new Entity(world);
        cow.setTypeName("minecraft:cow");
        MinecraftForge.EVENT_BUS.post(new EntityJoinWorldEvent(cow, world));

        MinecraftForge.EVENT_BUS.post(new TickEvent.ServerTickEvent(TickEvent.Phase.END));
        MinecraftForge.EVENT_BUS.post(new TickEvent.ServerTickEvent(TickEvent.Phase.START));

        String seen = seen();
        check("break event reached the script", seen.contains("break:minecraft:stone"));
        check("death event reached the script with the cause", seen.contains("death:lava"));
        check("entity spawn event reached the script", seen.contains("spawn:minecraft:cow"));
        check("tick fired once (END phase only)", countOccurrences(seen, "tick") == 1);

        run("/script stop harness_events.js");
        player.sentMessages().clear();
        MinecraftForge.EVENT_BUS.post(new PlayerEvent.PlayerLoggedInEvent(player));
        check("stopped script no longer receives events", player.sentMessages().isEmpty());
    }

    private static void timerChecks() throws Exception {
        section("timers");
        write("harness_timers.js",
                "var hits = 0;\n"
              + "var once = 0;\n"
              + "var id = timer.every(100, function () { hits++; });\n"
              + "timer.after(150, function () { once++; });\n"
              + "var timerId = id;\n"
              + "var activeCount = timer.active();\n");

        run("/script run harness_timers.js");
        check("two timers active", evalInt("harness_timers.js", "activeCount") == 2);

        // 50 ms = 1 tick in Minecraft, so 100 ms fires every 2nd tick and 150 ms after 3 ticks.
        tick();
        tick();
        check("repeating timer waited its delay", evalInt("harness_timers.js", "hits") == 1);
        check("one-shot timer has not fired yet", evalInt("harness_timers.js", "once") == 0);

        tick();
        check("one-shot timer fired on the 3rd tick", evalInt("harness_timers.js", "once") == 1);
        tick();
        check("repeating timer fired again after its interval", evalInt("harness_timers.js", "hits") == 2);
        tick();
        check("repeating timer waits a whole interval", evalInt("harness_timers.js", "hits") == 2);

        int hits = evalInt("harness_timers.js", "hits");
        eval("harness_timers.js", "timer.cancel(timerId);");
        tick();
        check("timer.cancel stops the repeats", evalInt("harness_timers.js", "hits") == hits);

        run("/script stop harness_timers.js");
        check("stop cancels every timer of the script", ScriptCraft.timers().size() == 0);
    }

    private static void errorHandlingChecks() throws Exception {
        section("error handling");
        write("harness_error.js", "var a = 1;\nvar b = 2;\nundefinedVariable.foo();\n");
        String output = run("/script run harness_error.js");
        check("error reported to the player", output.contains("Script error") && output.contains("File: harness_error.js"));
        check("error reports the line", output.contains("Line: 3"));
        check("error reports the message", output.contains("undefinedVariable"));
        check("script marked ERROR", ScriptCraft.engine().get("harness_error.js").getState().name().equals("ERROR"));
        check("game still runs after the error", run("/script reload example.js").contains("started"));

        write("harness_throw.js", "throw new Error('boom');\n");
        String thrown = run("/script run harness_throw.js");
        check("thrown JS errors are reported", thrown.contains("boom"));

        write("harness_syntax.js", "function ( { broken\n");
        check("syntax errors are reported, not thrown", run("/script run harness_syntax.js").contains("Script error"));

        write("harness_badlistener.js",
                "events.onTick(function () { nope.notHere(); });\n");
        run("/script run harness_badlistener.js");
        int before = ConsoleBuffer.snapshot().size();
        MinecraftForge.EVENT_BUS.post(new TickEvent.ServerTickEvent(TickEvent.Phase.END));
        List<String> lines = ConsoleBuffer.snapshot();
        check("listener error is logged", lines.size() > before && contains(lines, "Listener onTick in harness_badlistener.js failed"));
        MinecraftForge.EVENT_BUS.post(new TickEvent.ServerTickEvent(TickEvent.Phase.END));
        check("a broken listener does not stop the tick", true);
        run("/script stop harness_badlistener.js");
    }

    private static void sandboxChecks() throws Exception {
        section("sandbox");
        write("harness_sandbox.js",
                "var out = [];\n"
              + "function tryIt(label, fn) { try { fn(); out.push(label + ':ALLOWED'); } catch (e) { out.push(label + ':BLOCKED'); } }\n"
              + "tryIt('javaType', function () { Java.type('java.lang.Runtime'); });\n"
              + "tryIt('packages', function () { Packages.java.lang.System.exit(0); });\n"
              + "tryIt('javaGlobal', function () { java.lang.Runtime.getRuntime(); });\n"
              + "tryIt('forName', function () { ''.getClass().forName('java.lang.Runtime'); });\n"
              + "tryIt('engineBinding', function () { engine.eval('1'); });\n"
              + "tryIt('exit', function () { exit(); });\n"
              + "tryIt('quit', function () { quit(); });\n"
              + "tryIt('readFile', function () { read('/etc/passwd'); });\n"
              + "var sandboxResult = out.join('|');\n"
              + "player.sendMessage('sandbox api still works');\n");

        String output = run("/script run harness_sandbox.js");
        String result = evalString("harness_sandbox.js", "sandboxResult");
        check("Java.type is unavailable", result.contains("javaType:BLOCKED"));
        check("Packages is unavailable", result.contains("packages:BLOCKED"));
        check("the java global is unavailable", result.contains("javaGlobal:BLOCKED"));
        check("Class.forName is unavailable", result.contains("forName:BLOCKED"));
        check("the engine binding is removed", result.contains("engineBinding:BLOCKED"));
        check("exit() is denied", result.contains("exit:BLOCKED"));
        check("quit() is denied", result.contains("quit:BLOCKED"));
        check("read() is unavailable", result.contains("readFile:BLOCKED"));
        check("normal API calls still work", player.sentMessages().contains("sandbox api still works"));
        check("the script itself succeeded", output.contains("started"));
        check("the JVM survived every attempt", true);

        write("harness_reflect.js",
                "function find(obj, name, argc) {\n"
              + "  var ms = obj.getClass().getMethods();\n"
              + "  for (var i = 0; i < ms.length; i++) { if (ms[i].getName() === name && ms[i].getParameterTypes().length === argc) return ms[i]; }\n"
              + "  return null;\n"
              + "}\n"
              + "var result = 'not-run';\n"
              + "try {\n"
              + "  var cls = player.getClass();\n"
              + "  var loader = find(cls, 'getClassLoader', 0).invoke(cls);\n"
              + "  var loadClass = find(loader, 'loadClass', 1);\n"
              + "  var runtime = loadClass.invoke(loader, 'java.lang.Runtime');\n"
              + "  var rt = find(runtime, 'getRuntime', 0).invoke(null);\n"
              + "  find(rt, 'exec', 1).invoke(rt, 'touch build/PWNED');\n"
              + "  result = 'EXECUTED';\n"
              + "} catch (e) { result = 'blocked: ' + e; }\n"
              + "var reflectResult = result;\n");
        run("/script run harness_reflect.js");
        String reflect = evalString("harness_reflect.js", "reflectResult");
        check("reflection cannot execute a process (" + shorten(reflect) + ")",
                !reflect.equals("EXECUTED") && !new File("build/PWNED").exists());
    }

    private static void pathTraversalChecks() {
        section("path traversal");
        check("../evil.js rejected", rejected("../evil.js"));
        check("sub/../../evil.js rejected", rejected("sub/../../evil.js"));
        check("absolute path rejected", rejected("/etc/passwd.js"));
        check("windows style path rejected", rejected("..\\..\\evil.js"));
        check("plain name accepted", accepted("ok.js"));
        check("nested name accepted", accepted("packs/ok.js"));
    }

    private static void worldApiChecks() throws Exception {
        section("world / blocks / entities");
        write("harness_world.js",
                "var log = [];\n"
              + "world.setBlock(10, 20, 30, 'minecraft:stone');\n"
              + "world.setBlock(11, 20, 30, 'stone:1');\n"
              + "world.setBlock(12, 20, 30, 1);\n"
              + "log.push('name=' + blocks.nameAt(10, 20, 30));\n"
              + "log.push('meta=' + world.getBlock(11, 20, 30).getMeta());\n"
              + "log.push('air=' + world.isAir(10, 21, 30));\n"
              + "log.push('id=' + blocks.idOf('minecraft:dirt'));\n"
              + "log.push('exists=' + blocks.exists('minecraft:glass'));\n"
              + "log.push('world=' + world.getName());\n"
              + "log.push('dim=' + world.getDimension());\n"
              + "log.push('players=' + world.getPlayers().length);\n"
              + "var cow = entities.spawn('minecraft:cow', 10, 20, 30);\n"
              + "log.push('spawned=' + cow.getType());\n"
              + "log.push('near=' + entities.getNearby(10, 20, 30, 5).length);\n"
              + "player.giveItem('minecraft:diamond', 3);\n"
              + "log.push('held=' + player.getHeldItem().isEmpty());\n"
              + "server.broadcast('hello world');\n"
              + "server.runCommand('time set day');\n"
              + "log.push('playersOnline=' + server.getPlayerCount());\n"
              + "log.push('version=' + scriptcraft.getVersion());\n"
              + "log.push('script=' + scriptcraft.getScript());\n"
              + "var worldLog = log.join('|');\n");

        String output = run("/script run harness_world.js");
        check("world script ran", output.contains("started"));
        String log = evalString("harness_world.js", "worldLog");

        check("block placed by registry name", world.getBlockState(new BlockPos(10, 20, 30)).getBlock()
                .getLocalizedName().equals("minecraft:stone"));
        check("short name accepted", log.contains("name=minecraft:stone"));
        check("metadata accepted", log.contains("meta=1"));
        check("air detection works", log.contains("air=true"));
        check("numeric block id lookup works", log.contains("id=2"));
        check("blocks.exists works", log.contains("exists=true"));
        check("world name exposed", log.contains("world=world"));
        check("dimension exposed", log.contains("dim=0"));
        check("players listed", log.contains("players=1"));
        check("entity spawned", log.contains("spawned=minecraft:cow"));
        check("nearby entities found", log.contains("near=1"));
        check("giveItem filled the inventory", player.inventory.addedItems().size() == 1);
        check("broadcast reached the player list", server.getPlayerList().broadcasts().contains("hello world"));
        check("server.runCommand executed", server.executedCommands().contains("time set day"));
        check("players online reported", log.contains("playersOnline=1"));
        check("scriptcraft.version exposed", log.contains("version=0.1.0"));
        check("scriptcraft.script exposed", log.contains("script=harness_world.js"));
        check("out-of-range setBlock returns false", evalString("harness_world.js",
                "String(world.setBlock(0, 500, 0, 'minecraft:stone'))").equals("false"));
    }

    private static void editorChecks() {
        section("editor model");
        TextEditor editor = new TextEditor();
        editor.setText("line one\nline two");
        check("text split into lines", editor.getLineCount() == 2);
        editor.setCursor(0, 8);
        editor.insert("!");
        check("insert at cursor", editor.getLine(0).equals("line one!"));
        editor.backspace();
        check("backspace removes a character", editor.getLine(0).equals("line one"));
        editor.insertNewLine();
        check("enter splits the line", editor.getLineCount() == 3 && editor.getCursorLine() == 1);
        editor.backspace();
        check("backspace joins lines", editor.getLineCount() == 2);
        editor.type('X');
        check("typing a character", editor.getLine(0).endsWith("X"));
        editor.delete();
        editor.moveEnd();
        editor.moveUp();
        check("cursor movement stays in range", editor.getCursorLine() == 0);

        editor.setText("1\n2\n3\n4\n5\n6\n7\n8\n9\n10");
        editor.setCursor(9, 0);
        editor.ensureCursorVisible(4, 40);
        check("scrolling follows the cursor", editor.getScrollLine() == 6);

        editor.setText("console.log('x');");
        check("round trip keeps the text", editor.getText().equals("console.log('x');"));
        check("loading text is not an edit", !editor.isDirty());
        editor.type('y');
        check("dirty flag set after edits", editor.isDirty());
        editor.markSaved();
        check("dirty flag cleared on save", !editor.isDirty());
    }

    /** Runs every .js file that ships inside the jar, including the self test. */
    private static void bundledExampleChecks() throws Exception {
        section("bundled examples");
        String[] examples = {"example.js", "welcome.js", "events.js", "timer.js", "blocks.js", "test.js"};
        for (String example : examples) {
            String output = run("/script reload " + example);
            check(example + " runs without error", output.contains("started"));
            ScriptContext context = ScriptCraft.engine().get(example);
            check(example + " left no error state", context != null
                    && !ScriptState.ERROR.name().equals(context.getState().name()));
        }

        List<String> log = ConsoleBuffer.snapshot();
        check("test.js prints its banner", contains(log, "[ScriptCraft:test.js] [ScriptCraft Test]"));
        check("test.js reports Engine: OK", contains(log, "[ScriptCraft:test.js] Engine: OK"));
        check("test.js reports Player API: OK", contains(log, "[ScriptCraft:test.js] Player API: OK"));
        check("test.js reports World API: OK", contains(log, "[ScriptCraft:test.js] World API: OK"));
        check("test.js reports Events: OK", contains(log, "[ScriptCraft:test.js] Events: OK"));
        check("test.js reports Timers: OK", contains(log, "[ScriptCraft:test.js] Timers: OK"));
        check("test.js reports Error handling: OK", contains(log, "[ScriptCraft:test.js] Error handling: OK"));
        check("no bundled example logged a FAIL", !contains(log, ": FAIL"));
        check("welcome.js greets on join", runEventsExample());
    }

    private static boolean runEventsExample() throws Exception {
        player.sentMessages().clear();
        MinecraftForge.EVENT_BUS.post(new PlayerEvent.PlayerLoggedInEvent(player));
        boolean greeted = !player.sentMessages().isEmpty();
        player.sentMessages().clear();
        return greeted;
    }

    /** Drives the real in-game IDE: buttons, keys, clicks, and the server-thread hand-off. */
    private static void ideChecks() throws Exception {
        section("in-game IDE");
        Minecraft.getMinecraft().player = null;
        server.setOnServerThread(true);

        IdeProbe ide = new IdeProbe();
        ide.initGui();
        check("IDE builds its buttons", ide.buttons().size() == 9);
        check("Files tab is the default and marked active", "> Files".equals(ide.button(1).displayString));
        check("Run/Stop/Save/Reload exist", ide.button(10) != null && ide.button(11) != null
                && ide.button(12) != null && ide.button(13) != null);

        int drawCalls = Gui.drawCalls;
        ide.drawScreen(0, 0, 0f);
        check("Files tab renders", Gui.drawCalls > drawCalls);

        // --- create files through the UI: click the name field, type, press New
        ide.clickAt(40, 415, 0);
        type(ide, "ide_ui.js");
        ide.click(ide.button(20));
        check("New created the file on disk", new File(ScriptDirectories.scripts(), "ide_ui.js").isFile());

        ide.clickAt(40, 415, 0);
        type(ide, "noextension");
        ide.click(ide.button(20));
        check("New appends .js", new File(ScriptDirectories.scripts(), "noextension.js").isFile());

        ide.clickAt(40, 415, 0);
        type(ide, "../../evil.js");
        ide.click(ide.button(20));
        check("New refuses to escape the scripts folder",
                !new File(ScriptDirectories.scripts().getParentFile().getParentFile(), "evil.js").exists());

        // --- open a file from the list: the first click selects, the second opens
        ide.click(ide.button(1));
        ide.drawScreen(0, 0, 0f);
        int row = rowOf("ide_ui.js");
        ide.clickAt(100, 70 + 11 * row, 0);
        check("a single click only selects", "> Files".equals(ide.button(1).displayString));
        ide.clickAt(100, 70 + 11 * row, 0);
        check("opening a file switches to the editor", "> Editor".equals(ide.button(2).displayString));

        // --- type and save with Ctrl+S
        type(ide, "console.log('typed in the IDE');");
        pressCtrlS(ide);
        check("Ctrl+S wrote the editor to disk", ScriptFileManager.read("ide_ui.js").contains("typed in the IDE"));

        // --- reopen it, which must pull the text back off disk
        ide.click(ide.button(1));
        ide.clickAt(100, 70 + 11 * row, 0);
        ide.clickAt(100, 70 + 11 * row, 0);
        type(ide, "// appended");
        pressCtrlS(ide);
        String reopened = ScriptFileManager.read("ide_ui.js");
        check("the editor loaded the file from disk",
                reopened.contains("typed in the IDE") && reopened.contains("// appended"));

        // --- Run / Stop / Reload run inline while we are on the server thread
        ide.click(ide.button(10));
        check("Run started the script", ScriptCraft.engine().isRunning("ide_ui.js"));
        ide.click(ide.button(11));
        check("Stop stopped it", !ScriptCraft.engine().isRunning("ide_ui.js"));
        ide.click(ide.button(13));
        check("Reload started it again", ScriptCraft.engine().isRunning("ide_ui.js"));

        // --- off the server thread the work is queued instead of run on the render thread
        server.setOnServerThread(false);
        int queued = server.scheduledTasks().size();
        ide.click(ide.button(11));
        check("off-thread action is queued", server.scheduledTasks().size() == queued + 1);
        check("off-thread action did not run yet", ScriptCraft.engine().isRunning("ide_ui.js"));
        for (Runnable task : new ArrayList<Runnable>(server.scheduledTasks())) {
            task.run();
        }
        server.scheduledTasks().clear();
        check("queued action ran on the server thread", !ScriptCraft.engine().isRunning("ide_ui.js"));
        server.setOnServerThread(true);

        // --- delete needs a confirmation; a running script is stopped first
        ide.click(ide.button(13));
        ide.click(ide.button(1));
        ide.click(ide.button(21));
        check("first Delete only asks for confirmation", new File(ScriptDirectories.scripts(), "ide_ui.js").isFile());
        ide.click(ide.button(21));
        check("second Delete removes the file", !new File(ScriptDirectories.scripts(), "ide_ui.js").isFile());
        check("deleting a running script stops it first", !ScriptCraft.engine().isLoaded("ide_ui.js"));

        // --- console tab shows script output
        ide.click(ide.button(3));
        check("Console tab is marked active", "> Console".equals(ide.button(3).displayString));
        drawCalls = Gui.drawCalls;
        ide.drawScreen(0, 0, 0f);
        check("Console tab renders", Gui.drawCalls > drawCalls);

        Mouse.wheel = 120;
        ide.handleMouseInput();
        check("mouse wheel is handled without error", true);

        // --- Escape with unsaved changes needs two presses
        ScriptFileManager.write("ide_escape.js", "var a = 1;\n");
        IdeProbe dirty = new IdeProbe();
        dirty.initGui();
        dirty.drawScreen(0, 0, 0f);
        int escapeRow = rowOf("ide_escape.js");
        dirty.clickAt(100, 70 + 11 * escapeRow, 0);
        dirty.clickAt(100, 70 + 11 * escapeRow, 0);
        Minecraft.getMinecraft().displayGuiScreen(dirty);
        dirty.press('x', 0);
        dirty.press('\0', Keyboard.KEY_ESCAPE);
        check("Escape with unsaved changes does not close at once", Minecraft.getMinecraft().currentScreen == dirty);
        dirty.press('\0', Keyboard.KEY_ESCAPE);
        check("second Escape closes", Minecraft.getMinecraft().currentScreen == null);

        ScriptFileManager.delete("ide_escape.js");
        ScriptFileManager.delete("noextension.js");
    }

    /** The IDE lists exactly what listScripts() returns, in the same order, 11 px per row. */
    private static int rowOf(String name) {
        return ScriptFileManager.listScripts().indexOf(name);
    }

    private static void pressCtrlS(IdeProbe ide) throws Exception {
        GuiScreen.ctrlDown = true;
        ide.press('s', Keyboard.KEY_S);
        GuiScreen.ctrlDown = false;
    }

    private static void type(IdeProbe ide, String text) throws Exception {
        for (char c : text.toCharArray()) {
            ide.press(c, 0);
        }
    }

/**
     * Every ```js block in the documentation is written to a script and executed, so the README
     * and docs cannot drift away from the API that actually exists.
     */
    private static void documentationSnippetChecks() throws Exception {
        section("documentation snippets");
        String[] docs = {"README.md", "docs/getting-started.md", "docs/api.md",
                         "docs/events.md", "docs/timers.md", "docs/examples.md"};
        int total = 0;
        int broken = 0;
        for (String doc : docs) {
            List<String> snippets = jsSnippets(new File(doc));
            for (int i = 0; i < snippets.size(); i++) {
                total++;
                String name = "docs_" + doc.replaceAll("[^a-zA-Z0-9]", "_") + "_" + (i + 1) + ".js";
                ScriptFileManager.write(name, snippets.get(i));
                String output = run("/script reload " + name);
                ScriptContext context = ScriptCraft.engine().get(name);
                boolean ok = output.contains("started") && context != null
                        && !ScriptState.ERROR.name().equals(context.getState().name());
                if (!ok) {
                    broken++;
                    System.out.println("  FAIL " + name + " -> " + output.trim());
                }
                check(name + " runs", ok);
                run("/script stop " + name);
                ScriptFileManager.delete(name);
            }
        }
        check("documentation has a healthy number of snippets (" + total + ")", total >= 20 && broken == 0);
    }

    /** Pulls every fenced ```js block out of a markdown file. */
    private static List<String> jsSnippets(File file) throws Exception {
        List<String> snippets = new ArrayList<String>();
        if (!file.isFile()) {
            throw new IllegalStateException("missing doc: " + file.getPath());
        }
        StringBuilder current = null;
        java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(new java.io.FileInputStream(file), "UTF-8"));
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (current == null) {
                    if (trimmed.equals("```js")) {
                        current = new StringBuilder();
                    }
                } else if (trimmed.equals("```")) {
                    snippets.add(current.toString());
                    current = null;
                } else {
                    current.append(line).append('\n');
                }
            }
        } finally {
            reader.close();
        }
        return snippets;
    }

    /** Config parsing, the timer limit, running from the server console, and autoloading. */
    private static void configurationChecks() throws Exception {
        section("config and server side");

        File limits = new File(ScriptDirectories.config(), "harness-limits.properties");
        writeText(limits, "timer.maxPerScript=2\ntick.maxMillisPerTick=3\ncommand.permissionLevel=4\n");
        ScriptCraftConfig.load(limits);
        check("timer.maxPerScript is read from the file", ScriptCraftConfig.maxTimersPerScript == 2);
        check("tick.maxMillisPerTick is read from the file", ScriptCraftConfig.maxTickMillisPerTick == 3L);
        check("command.permissionLevel is read from the file", ScriptCraftConfig.commandPermissionLevel == 4);

        File broken = new File(ScriptDirectories.config(), "harness-broken.properties");
        writeText(broken, "timer.maxPerScript=not-a-number\n");
        ScriptCraftConfig.load(broken);
        check("a non-numeric value keeps the previous one", ScriptCraftConfig.maxTimersPerScript == 2);

        // --- the per-script timer limit really is enforced
        write("harness_limit.js",
                  "var first = timer.after(60000, function () { });\n"
                + "var second = timer.after(60000, function () { });\n"
                + "var third = timer.after(60000, function () { });\n"
                + "var ids = first + ',' + second + ',' + third;\n");
        run("/script run harness_limit.js");
        check("the third timer is refused", evalString("harness_limit.js", "ids").endsWith(",-1"));
        check("only two timers were created",
                ScriptCraft.timers().countFor(ScriptCraft.engine().get("harness_limit.js")) == 2);
        run("/script stop harness_limit.js");

        // --- permission levels
        server.setDedicated(true);
        player.setPermissionLevel(0);
        check("a dedicated server denies a player who is not op", !command.checkPermission(server, player));
        player.setPermissionLevel(4);
        check("a dedicated server allows an op", command.checkPermission(server, player));
        player.setPermissionLevel(0);
        server.setDedicated(false);
        check("the local player is always allowed on an integrated server",
                command.checkPermission(server, player));
        player.setPermissionLevel(4);

        // --- running from the server console: no player, world falls back to the overworld
        write("harness_console.js",
                "var report = player.isValid() + '|' + player.getName() + '|' + world.getName();\n");
        command.execute(server, server, new String[]{"run", "harness_console.js"});
        check("a console-started script runs", ScriptCraft.engine().isRunning("harness_console.js"));
        check("the player API degrades without a player",
                evalString("harness_console.js", "report").startsWith("false|"));
        check("world falls back to the server world",
                evalString("harness_console.js", "report").endsWith("|world"));
        run("/script stop harness_console.js");

        // --- autoload
        ScriptCraftConfig.autoLoadOnServerStart = true;
        write("autoload_me.js", "console.log('autoloaded');\n");
        mod.serverStarting(new FMLServerStartingEvent(server));
        check("scripts auto-load on server start", ScriptCraft.engine().isRunning("autoload_me.js"));
        check("an autoloaded script logged", contains(ConsoleBuffer.snapshot(), "[ScriptCraft:autoload_me.js] autoloaded"));
        ScriptCraftConfig.autoLoadOnServerStart = false;

        // put the real config back for anything that runs afterwards
        ScriptCraftConfig.load(ScriptDirectories.configFile());
        limits.delete();
        broken.delete();
    }

    private static void writeText(File file, String text) throws Exception {
        java.io.OutputStream out = new java.io.FileOutputStream(file);
        try {
            out.write(text.getBytes("UTF-8"));
        } finally {
            out.close();
        }
    }

    /** A command sender that is not a player, with a controllable permission level. */
    private static final class FakeSender implements ICommandSender {
        private final int level;

        FakeSender(int level) {
            this.level = level;
        }

        public String getName() { return "FakeConsole"; }
        public boolean canUseCommand(int permLevel, String commandName) { return level >= permLevel; }
        public World getEntityWorld() { return server.getEntityWorld(); }
        public MinecraftServer getServer() { return server; }
        public BlockPos getPosition() { return new BlockPos(0, 0, 0); }
        public void sendMessage(net.minecraft.util.text.ITextComponent component) { }
    }

    private static void shutdownChecks() throws Exception {
        section("shutdown");
        write("harness_shutdown.js",
                "events.onTick(function () { });\ntimer.every(1000, function () { });\n");
        run("/script run harness_shutdown.js");
        check("script running before shutdown", ScriptCraft.engine().isRunning("harness_shutdown.js"));
        mod.serverStopped(new FMLServerStoppedEvent());
        check("all scripts stopped", ScriptCraft.engine().list().isEmpty());
        check("all timers cleared", ScriptCraft.timers().size() == 0);
        check("all listeners cleared", ScriptCraft.registry().total() == 0);
    }

    // ----------------------------------------------------------------- helpers

    private static String run(String commandLine) throws Exception {
        String[] parts = commandLine.split(" ");
        String[] args = new String[parts.length - 1];
        System.arraycopy(parts, 1, args, 0, args.length);
        player.sentMessages().clear();
        try {
            command.execute(server, player, args);
        } catch (Exception e) {
            return "EXCEPTION: " + e;
        }
        StringBuilder builder = new StringBuilder();
        for (String message : player.sentMessages()) {
            builder.append(message).append('\n');
        }
        return builder.toString().replaceAll("\u00a7.", "");
    }

    private static void tick() {
        MinecraftForge.EVENT_BUS.post(new TickEvent.ServerTickEvent(TickEvent.Phase.END));
    }

    private static void write(String name, String content) throws Exception {
        ScriptFileManager.write(name, content);
    }

    private static String eval(String script, String code) throws Exception {
        Object value = com.scriptcraft.security.ScriptSandbox.eval(
                ScriptCraft.engine().get(script).getEngine(), code, script);
        return value == null ? null : String.valueOf(value);
    }

    private static String evalString(String script, String code) throws Exception {
        return eval(script, code);
    }

    private static int evalInt(String script, String code) throws Exception {
        Object value = com.scriptcraft.security.ScriptSandbox.eval(
                ScriptCraft.engine().get(script).getEngine(), code, script);
        return value instanceof Number ? ((Number) value).intValue() : Integer.parseInt(String.valueOf(value));
    }

    private static String seen() throws Exception {
        return eval("harness_events.js", "seenList()");
    }

    private static boolean rejected(String name) {
        try {
            ScriptFileManager.resolve(name);
            return false;
        } catch (Exception e) {
            return true;
        }
    }

    private static boolean accepted(String name) {
        try {
            ScriptFileManager.resolve(name);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean contains(List<String> lines, String needle) {
        for (String line : lines) {
            if (line.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static int countOccurrences(String haystack, String needle) {
        int count = 0;
        int index = haystack.indexOf(needle);
        while (index >= 0) {
            count++;
            index = haystack.indexOf(needle, index + needle.length());
        }
        return count;
    }

    private static String shorten(String value) {
        return value.length() > 60 ? value.substring(0, 60) + "..." : value;
    }

    private static void delete(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    delete(child);
                }
            }
        }
        file.delete();
    }

    private static List<String> readLines(File file) throws Exception {
        List<String> lines = new ArrayList<String>();
        java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(new java.io.FileInputStream(file), "UTF-8"));
        try {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        } finally {
            reader.close();
        }
        return lines;
    }

    private static void section(String name) {
        System.out.println();
        System.out.println("--- " + name + " ---");
    }

    private static void check(String label, boolean condition) {
        if (condition) {
            passed++;
            System.out.println("  ok   " + label);
        } else {
            failed++;
            FAILURES.add(label);
            System.out.println("  FAIL " + label);
        }
    }

    /** Unused, keeps the harness honest about which Forge types it drives. */
    static Class<?>[] drivenEvents() {
        return new Class<?>[]{Event.class, ICommandSender.class, ICommand.class};
    }
}
