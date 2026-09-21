package com.scriptcraft.filesystem;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * All file access for scripts goes through this class.
 *
 * <p>A name is looked up in two places, in this order:
 * <ol>
 *   <li>{@code .minecraft/scriptcraft/scripts} — where the mod writes new files, and</li>
 *   <li>{@code .minecraft/scriptcraft} itself, so a script dropped next to {@code config/} and
 *       {@code logs/} is found too.</li>
 * </ol>
 * Whichever candidate matches, its canonical path must stay inside the {@code scriptcraft} folder,
 * so {@code ../../etc/passwd}, absolute paths and symlink tricks are rejected before any IO happens.
 */
public final class ScriptFileManager {

    public static final String EXTENSION = ".js";

    private ScriptFileManager() {
    }

    public static boolean isScriptName(String fileName) {
        return fileName != null && fileName.toLowerCase(java.util.Locale.ROOT).endsWith(EXTENSION);
    }

    /**
     * Resolves a user supplied name to the script file to use.
     *
     * <p>Existing files win ({@code scripts/} before {@code scriptcraft/}); when neither exists the
     * returned path is the one a new file would be created at, which is {@code scripts/}.
     *
     * @throws IOException if the name is empty, not a {@code .js} file or escapes the folders
     */
    public static File resolve(String fileName) throws IOException {
        if (fileName == null || fileName.trim().isEmpty()) {
            throw new IOException("No file name given");
        }
        String name = fileName.trim();
        if (name.startsWith("/") || name.startsWith("\\")) {
            throw new IOException("Script paths must be relative to the scripts directory: " + fileName);
        }
        name = name.replace('\\', '/');
        if (name.contains(":")) {
            throw new IOException("Script paths must be relative to the scripts directory: " + fileName);
        }
        if (name.isEmpty() || name.contains("..")) {
            throw new IOException("Illegal script path: " + fileName);
        }
        if (!isScriptName(name)) {
            throw new IOException("Not a JavaScript file (must end with " + EXTENSION + "): " + fileName);
        }

        File scripts = ScriptDirectories.scripts().getCanonicalFile();
        File primary = new File(scripts, name).getCanonicalFile();
        if (!isInside(scripts, primary)) {
            throw new IOException("Path escapes the scripts directory: " + fileName);
        }
        if (primary.isFile()) {
            return primary;
        }

        File root = ScriptDirectories.root().getCanonicalFile();
        File secondary = new File(root, name).getCanonicalFile();
        if (!isInside(root, secondary)) {
            throw new IOException("Path escapes the scripts directory: " + fileName);
        }
        if (secondary.isFile()) {
            return secondary;
        }
        return primary;
    }

    /**
     * Where script names are looked up, for error messages. Short on purpose: it goes into chat.
     */
    public static String searchDescription() {
        return "scriptcraft/scripts and scriptcraft/ (inside " + ScriptDirectories.root().getParentFile()
                + ")";
    }

    /** The file a name resolves to, or null when it does not exist. */
    public static File locate(String fileName) {
        try {
            File file = resolve(fileName);
            return file.isFile() ? file : null;
        } catch (IOException e) {
            return null;
        }
    }

    /** Path of a script relative to the game directory, for {@code /script info}. */
    public static String describe(File file) {
        if (file == null) {
            return "?";
        }
        try {
            return ScriptDirectories.root().getParentFile().toURI().relativize(file.toURI()).getPath();
        } catch (RuntimeException e) {
            return file.getAbsolutePath();
        }
    }

    public static boolean exists(String fileName) {
        try {
            return resolve(fileName).isFile();
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * Names of every {@code .js} script, sorted: the {@code scripts} folder first, then the
     * {@code scriptcraft} folder. A name in both places is listed once and resolves to the
     * {@code scripts} copy, which is what {@link #resolve(String)} does.
     */
    public static List<String> listScripts() {
        List<String> names = new ArrayList<String>();
        addScripts(new File(ScriptDirectories.scripts(), "").listFiles(), names);
        addScripts(ScriptDirectories.root().listFiles(), names);
        Collections.sort(names, String.CASE_INSENSITIVE_ORDER);
        return names;
    }

    private static void addScripts(File[] files, List<String> names) {
        if (files == null) {
            return;
        }
        for (File file : files) {
            if (file.isFile() && isScriptName(file.getName()) && !names.contains(file.getName())) {
                names.add(file.getName());
            }
        }
    }

    public static String read(String fileName) throws IOException {
        File file = resolve(fileName);
        if (!file.isFile()) {
            throw new IOException("No such script: " + fileName);
        }
        InputStream in = null;
        try {
            in = new FileInputStream(file);
            byte[] buffer = new byte[(int) Math.max(file.length(), 1024)];
            int read = 0;
            int chunk;
            while (read < buffer.length && (chunk = in.read(buffer, read, buffer.length - read)) != -1) {
                read += chunk;
            }
            return new String(buffer, 0, read, "UTF-8");
        } finally {
            close(in);
        }
    }

    public static void write(String fileName, String content) throws IOException {
        File file = resolve(fileName);
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            throw new IOException("Could not create directory " + parent.getAbsolutePath());
        }
        Writer out = null;
        try {
            out = new OutputStreamWriter(new FileOutputStream(file), "UTF-8");
            out.write(content == null ? "" : content);
        } finally {
            close(out);
        }
    }

    public static void create(String fileName) throws IOException {
        File file = resolve(fileName);
        if (file.isFile()) {
            throw new IOException("Script already exists: " + fileName);
        }
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            throw new IOException("Could not create directory " + parent.getAbsolutePath());
        }
        if (!file.createNewFile()) {
            throw new IOException("Could not create " + fileName);
        }
    }

    public static void delete(String fileName) throws IOException {
        File file = resolve(fileName);
        if (!file.isFile()) {
            throw new IOException("No such script: " + fileName);
        }
        if (!file.delete()) {
            throw new IOException("Could not delete " + fileName);
        }
    }

    public static long sizeOf(String fileName) {
        try {
            File file = resolve(fileName);
            return file.isFile() ? file.length() : -1L;
        } catch (IOException e) {
            return -1L;
        }
    }

    private static boolean isInside(File root, File target) {
        if (target.equals(root)) {
            return false;
        }
        File parent = target.getParentFile();
        while (parent != null) {
            if (parent.equals(root)) {
                return true;
            }
            parent = parent.getParentFile();
        }
        return false;
    }

    private static void close(java.io.Closeable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (IOException ignored) {
                // nothing useful to do here
            }
        }
    }

    /** Unused but handy for callers that only have a stream (e.g. copying bundled examples). */
    public static void copyStream(InputStream in, File target) throws IOException {
        OutputStream out = null;
        try {
            out = new FileOutputStream(target);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
        } finally {
            close(out);
        }
    }
}
