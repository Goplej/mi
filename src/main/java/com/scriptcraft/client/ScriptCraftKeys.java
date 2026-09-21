package com.scriptcraft.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.settings.KeyBinding;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.client.registry.ClientRegistry;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.InputEvent;
import net.minecraftforge.fml.relauncher.Side;
import net.minecraftforge.fml.relauncher.SideOnly;
import org.lwjgl.input.Keyboard;

/** Registers the "K" binding that opens the IDE. */
@SideOnly(Side.CLIENT)
public final class ScriptCraftKeys {

    public static final String CATEGORY = "ScriptCraft";

    public static KeyBinding openIde;

    private ScriptCraftKeys() {
    }

    public static void register() {
        openIde = new KeyBinding("key.scriptcraft.openIde", Keyboard.KEY_K, CATEGORY);
        ClientRegistry.registerKeyBinding(openIde);
        MinecraftForge.EVENT_BUS.register(new Handler());
    }

    @SideOnly(Side.CLIENT)
    private static final class Handler {

        @SubscribeEvent
        public void onKeyInput(InputEvent.KeyInputEvent event) {
            if (openIde != null && openIde.isPressed()) {
                Minecraft.getMinecraft().displayGuiScreen(new GuiScriptIde());
            }
        }
    }
}
