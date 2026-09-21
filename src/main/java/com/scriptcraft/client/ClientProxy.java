package com.scriptcraft.client;

import com.scriptcraft.server.CommonProxy;
import net.minecraft.client.Minecraft;
import net.minecraftforge.fml.relauncher.Side;
import net.minecraftforge.fml.relauncher.SideOnly;

/**
 * Client proxy. Only instantiated by Forge inside a Minecraft client, which is what keeps
 * {@link Minecraft} and the GUI classes away from a dedicated server.
 */
@SideOnly(Side.CLIENT)
public class ClientProxy extends CommonProxy {

    @Override
    public void init() {
        ScriptCraftKeys.register();
    }

    @Override
    public boolean isClient() {
        return true;
    }

    @Override
    public void openIde() {
        Minecraft.getMinecraft().displayGuiScreen(new GuiScriptIde());
    }
}
