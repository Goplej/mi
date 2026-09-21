// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.fml.common.event;

import org.apache.logging.log4j.Logger;

import java.io.File;

public class FMLPreInitializationEvent {
    private final File configDir;

    public FMLPreInitializationEvent(File configDirIn) { this.configDir = configDirIn; }

    public File getModConfigurationDirectory() { return configDir; }
    public File getSourceFile() { return new File("scriptcraft.jar"); }
    public Logger getModLog() { return org.apache.logging.log4j.LogManager.getLogger("scriptcraft"); }
}
