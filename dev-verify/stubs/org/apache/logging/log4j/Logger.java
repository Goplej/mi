// COMPILE-TIME STAND-IN. Not part of the mod jar. Signatures mirror Minecraft 1.12.2 (MCP stable_39);
// bodies are fakes so the mod can be compiled and exercised headlessly in dev-verify.
package org.apache.logging.log4j;

public interface Logger {
    void info(String message);
    void warn(String message);
    void error(String message);
    void error(String message, Throwable throwable);
}
