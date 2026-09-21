package com.scriptcraft.commands;

import com.scriptcraft.ScriptCraft;
import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.engine.ScriptEngineManager;
import com.scriptcraft.engine.ScriptError;
import com.scriptcraft.engine.ScriptResult;
import com.scriptcraft.events.ScriptEventRegistry;
import com.scriptcraft.filesystem.ScriptDirectories;
import com.scriptcraft.filesystem.ScriptFileManager;
import net.minecraft.command.CommandBase;
import net.minecraft.command.CommandException;
import net.minecraft.command.ICommandSender;
import net.minecraft.command.WrongUsageException;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.server.MinecraftServer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.text.TextComponentString;
import net.minecraft.util.text.TextFormatting;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * {@code /script} - the command line front end of the mod.
 *
 * <pre>
 * /script help
 * /script list
 * /script run example.js
 * /script stop example.js
 * /script reload example.js
 * /script reloadall
 * /script info example.js
 * /script new example.js
 * /script ide
 * </pre>
 */
public class ScriptCommand extends CommandBase {

    private static final String[] SUBCOMMANDS = {"help", "list", "run", "stop", "reload", "reloadall", "info", "new", "ide"};

    private final ScriptEngineManager engine;
    private final ScriptEventRegistry registry;

    public ScriptCommand(ScriptEngineManager engine, ScriptEventRegistry registry) {
        this.engine = engine;
        this.registry = registry;
    }

    @Override
    public String getName() {
        return "script";
    }

    @Override
    public String getUsage(ICommandSender sender) {
        return "/script <help|list|run|stop|reload|reloadall|info|new|ide> [file]";
    }

    @Override
    public List<String> getAliases() {
        return Collections.singletonList("scripts");
    }

    @Override
    public int getRequiredPermissionLevel() {
        return ScriptCraftConfig.commandPermissionLevel;
    }

    @Override
    public boolean checkPermission(MinecraftServer server, ICommandSender sender) {
        // Single player: the local player owns the world (and the .minecraft folder anyway).
        if (sender instanceof EntityPlayer && server != null && !server.isDedicatedServer()) {
            return true;
        }
        return sender.canUseCommand(getRequiredPermissionLevel(), getName());
    }

    @Override
    public void execute(MinecraftServer server, ICommandSender sender, String[] args) throws CommandException {
        String sub = args.length == 0 ? "help" : args[0].toLowerCase(Locale.ROOT);

        if ("help".equals(sub)) {
            help(sender);
        } else if ("list".equals(sub)) {
            list(sender);
        } else if ("run".equals(sub)) {
            run(sender, requireFile(args, "run"));
        } else if ("stop".equals(sub)) {
            stop(sender, requireFile(args, "stop"));
        } else if ("reload".equals(sub)) {
            reload(sender, requireFile(args, "reload"));
        } else if ("reloadall".equals(sub)) {
            reloadAll(sender);
        } else if ("info".equals(sub)) {
            info(sender, requireFile(args, "info"));
        } else if ("new".equals(sub)) {
            create(sender, requireFile(args, "new"));
        } else if ("ide".equals(sub)) {
            if (ScriptCraft.proxy.isClient()) {
                ScriptCraft.proxy.openIde();
            } else {
                send(sender, TextFormatting.YELLOW,
                        "The IDE is client-only. On a server, edit the files in scriptcraft/scripts and use /script reload.");
            }
        } else {
            throw new WrongUsageException(getUsage(sender));
        }
    }

    @Override
    public List<String> getTabCompletions(MinecraftServer server, ICommandSender sender, String[] args, BlockPos targetPos) {
        if (args.length == 1) {
            return getListOfStringsMatchingLastWord(args, SUBCOMMANDS);
        }
        if (args.length == 2 && !"reloadall".equals(args[0].toLowerCase(Locale.ROOT)) && !"ide".equals(args[0].toLowerCase(Locale.ROOT))) {
            return getListOfStringsMatchingLastWord(args, ScriptFileManager.listScripts());
        }
        return Collections.emptyList();
    }

    private void help(ICommandSender sender) {
        send(sender, TextFormatting.GOLD, "ScriptCraft " + com.scriptcraft.core.Reference.VERSION + " - commands");
        send(sender, "/script list              - all scripts and their state");
        send(sender, "/script run <file>        - load and execute a script");
        send(sender, "/script stop <file>       - stop it, remove listeners and timers");
        send(sender, "/script reload <file>     - stop + run again");
        send(sender, "/script reloadall         - reload every loaded script");
        send(sender, "/script info <file>       - state, timers, listeners, last error");
        send(sender, "/script new <file>        - create an empty script");
        send(sender, "/script ide               - open the in-game IDE (client only)");
        send(sender, TextFormatting.DARK_GRAY, "Scripts live in .minecraft/scriptcraft/ or in its scripts/ subfolder.");
        send(sender, TextFormatting.DARK_GRAY, "New scripts are created in scriptcraft/scripts/.");
    }

    private void list(ICommandSender sender) {
        List<String> files = ScriptFileManager.listScripts();
        send(sender, TextFormatting.GOLD, "Scripts (" + files.size() + " in scriptcraft/ and scriptcraft/scripts):");
        if (files.isEmpty()) {
            send(sender, TextFormatting.GRAY, "  (no .js files yet - try /script new example.js)");
            return;
        }
        for (String file : files) {
            ScriptContext context = engine.get(file);
            String state = context == null ? "STOPPED" : context.getState().name();
            TextFormatting color = "RUNNING".equals(state) ? TextFormatting.GREEN
                    : "ERROR".equals(state) ? TextFormatting.RED : TextFormatting.GRAY;
            send(sender, color, "  [" + state + "] " + file + locationSuffix(file));
        }
    }

    /** Marks scripts that live in the scriptcraft folder itself rather than in scripts/. */
    private static String locationSuffix(String file) {
        File resolved = ScriptFileManager.locate(file);
        if (resolved == null) {
            return "";
        }
        return resolved.getParentFile().equals(ScriptDirectories.scripts()) ? "" : "   (scriptcraft/)";
    }

    private void run(ICommandSender sender, String file) {
        ScriptResult result = engine.run(file, owner(sender));
        report(sender, file, result);
        if (result.isSuccess() && owner(sender) == null) {
            send(sender, TextFormatting.YELLOW,
                    "Started without a player: 'player' is not available to this script. "
                    + "Run it in game for player access, or use server/world/console in it.");
        }
    }

    private void stop(ICommandSender sender, String file) {
        report(sender, file, engine.stop(file));
    }

    private void reload(ICommandSender sender, String file) {
        report(sender, file, engine.reload(file, owner(sender)));
    }

    private void reloadAll(ICommandSender sender) {
        List<ScriptContext> loaded = engine.list();
        if (loaded.isEmpty()) {
            send(sender, TextFormatting.YELLOW, "No scripts are loaded.");
            return;
        }
        int ok = 0;
        for (ScriptContext context : new ArrayList<ScriptContext>(loaded)) {
            ScriptResult result = engine.reload(context.getName(), context.getOwner());
            if (result.isSuccess()) {
                ok++;
            }
        }
        send(sender, TextFormatting.GREEN, "Reloaded " + ok + "/" + loaded.size() + " script(s).");
    }

    private void info(ICommandSender sender, String file) {
        ScriptContext context = engine.get(file);
        long size = ScriptFileManager.sizeOf(file);
        send(sender, TextFormatting.GOLD, "Script: " + file);
        send(sender, "  File:    " + ScriptFileManager.describe(ScriptFileManager.locate(file)));
        send(sender, "  On disk: " + (size >= 0 ? size + " bytes" : "missing"));
        if (context == null) {
            send(sender, "  State:   " + TextFormatting.GRAY + "STOPPED (not loaded)");
            return;
        }
        send(sender, "  State:   " + context.getState().name());
        send(sender, "  Timers:  " + engine.getTimers().countFor(context));
        send(sender, "  Listeners: " + registry.countFor(context));
        if (context.getStartedAtMillis() > 0) {
            long seconds = (System.currentTimeMillis() - context.getStartedAtMillis()) / 1000L;
            send(sender, "  Uptime:  " + seconds + "s");
        }
        ScriptError error = context.getLastError();
        send(sender, "  Last error: " + (error == null ? "-" : error.getMessage()));
    }

    private void create(ICommandSender sender, String file) {
        try {
            ScriptFileManager.create(file);
            send(sender, TextFormatting.GREEN, "Created " + file);
        } catch (IOException e) {
            send(sender, TextFormatting.RED, e.getMessage());
        }
    }

    private void report(ICommandSender sender, String file, ScriptResult result) {
        if (result.isSuccess()) {
            send(sender, TextFormatting.GREEN, result.getMessage());
            return;
        }
        ScriptError error = result.getError();
        if (error != null) {
            send(sender, TextFormatting.RED, "Script error");
            send(sender, TextFormatting.RED, "File: " + error.getFile());
            send(sender, TextFormatting.RED, "Line: " + (error.getLine() >= 0 ? String.valueOf(error.getLine()) : "unknown"));
            send(sender, TextFormatting.RED, "Error: " + error.getMessage());
        } else {
            send(sender, TextFormatting.RED, result.getMessage());
        }
    }

    private static Object owner(ICommandSender sender) {
        return sender instanceof EntityPlayer ? sender : null;
    }

    private static String requireFile(String[] args, String sub) throws CommandException {
        if (args.length < 2 || args[1].trim().isEmpty()) {
            throw new WrongUsageException("/script " + sub + " <file.js>");
        }
        return args[1].trim();
    }

    private static void send(ICommandSender sender, String message) {
        sender.sendMessage(new TextComponentString(message));
    }

    private static void send(ICommandSender sender, TextFormatting color, String message) {
        sender.sendMessage(new TextComponentString(color + message));
    }
}
