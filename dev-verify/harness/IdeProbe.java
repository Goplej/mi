package harness;

import com.scriptcraft.client.GuiScriptIde;
import net.minecraft.client.gui.GuiButton;
import net.minecraftforge.fml.relauncher.Side;
import net.minecraftforge.fml.relauncher.SideOnly;

import java.io.IOException;
import java.util.List;

/**
 * Exposes the protected {@code GuiScreen} hooks so the harness can drive the IDE the way a player
 * does - key presses, clicks and button presses - instead of poking at private fields.
 */
@SideOnly(Side.CLIENT)
public class IdeProbe extends GuiScriptIde {

    public List<GuiButton> buttons() {
        return buttonList;
    }

    public GuiButton button(int id) {
        for (GuiButton button : buttonList) {
            if (button.id == id) {
                return button;
            }
        }
        return null;
    }

    public void press(char typedChar, int keyCode) throws IOException {
        keyTyped(typedChar, keyCode);
    }

    public void click(GuiButton button) throws IOException {
        actionPerformed(button);
    }

    public void clickAt(int mouseX, int mouseY, int mouseButton) throws IOException {
        mouseClicked(mouseX, mouseY, mouseButton);
    }
}
