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
 * <p>Every name is resolved against {@code .minecraft/scriptcraft/scripts} and the resulting
 * canonical path must stay inside that folder, so {@code ../../etc/passwd}, absolute paths and
 * symlink tricks are rejected before any IO happens.
 */
public final class ScriptFileManager {

    public static final String EXTENSION = ".js";

    private ScriptFileManager() {
    }

    public static boolean isScriptName(String fileName) {
        return fileName != null && fileName.toLowerCase(java.util.Locale.ROOT).endsWith(EXTENSION);
    }

    /**
     * Resolves a user supplied name to a file inside the scripts folder.
     *
     * @throws IOException if the name is empty, not a {@code .js} file or escapes the folder
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

        File base = ScriptDirectories.scripts().getCanonicalFile();
        File target = new File(base, name).getCanonicalFile();
        if (!isInside(base, target)) {
            throw new IOException("Path escapes the scripts directory: " + fileName);
        }
        return target;
    }

    public static boolean exists(String fileName) {
        try {
            return resolve(fileName).isFile();
        } catch (IOException e) {
            return false;
        }
    }

    /** Names of all {@code .js} files in the scripts folder, sorted, relative to that folder. */
    public static List<String> listScripts() {
        List<String> names = new ArrayList<String>();
        File dir = ScriptDirectories.scripts();
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isFile() && isScriptName(file.getName())) {
                    names.add(file.getName());
                }
            }
        }
        Collections.sort(names, String.CASE_INSENSITIVE_ORDER);
        return names;
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
