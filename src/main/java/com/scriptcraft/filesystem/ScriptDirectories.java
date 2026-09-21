package com.scriptcraft.filesystem;

import com.scriptcraft.core.Reference;
import com.scriptcraft.core.ScriptCraftLog;

import java.io.File;

/**
 * Owns the {@code .minecraft/scriptcraft} folder tree and creates it on first start:
 *
 * <pre>
 * .minecraft/scriptcraft/
 *     scripts/   - user scripts, the only folder /script can reach
 *     config/    - scriptcraft.properties
 *     logs/      - script + engine log
 * </pre>
 */
public final class ScriptDirectories {

    private static File root;
    private static File scripts;
    private static File config;
    private static File logs;

    private ScriptDirectories() {
    }

    public static void init(File gameDir) {
        root = mkdir(new File(gameDir, Reference.FOLDER));
        scripts = mkdir(new File(root, Reference.SCRIPTS_SUBDIR));
        config = mkdir(new File(root, Reference.CONFIG_SUBDIR));
        logs = mkdir(new File(root, Reference.LOGS_SUBDIR));
    }

    public static File root() {
        return root;
    }

    public static File scripts() {
        return scripts;
    }

    public static File config() {
        return config;
    }

    public static File logs() {
        return logs;
    }

    public static File configFile() {
        return new File(config, Reference.MOD_ID + ".properties");
    }

    /** Log file for the current day, e.g. {@code scriptcraft-2026-09-21.log}. */
    public static File logFile() {
        String day = new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date());
        return new File(logs, Reference.MOD_ID + "-" + day + ".log");
    }

    private static File mkdir(File dir) {
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            ScriptCraftLog.error("Could not create directory: " + dir.getAbsolutePath());
        }
        return dir;
    }
}
