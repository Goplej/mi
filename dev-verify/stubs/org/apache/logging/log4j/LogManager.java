// COMPILE-TIME STAND-IN. Not part of the mod jar. Signatures mirror Minecraft 1.12.2 (MCP stable_39);
// bodies are fakes so the mod can be compiled and exercised headlessly in dev-verify.
package org.apache.logging.log4j;

public final class LogManager {
    private LogManager() {
    }

    public static Logger getLogger(String name) {
        return new Logger() {
            public void info(String message) { System.out.println("[" + name + "] " + message); }
            public void warn(String message) { System.out.println("[" + name + "/WARN] " + message); }
            public void error(String message) { System.out.println("[" + name + "/ERROR] " + message); }
            public void error(String message, Throwable t) { System.out.println("[" + name + "/ERROR] " + message + " " + t); }
        };
    }
}
