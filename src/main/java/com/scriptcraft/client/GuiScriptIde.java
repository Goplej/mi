package com.scriptcraft.client;

import com.scriptcraft.ScriptCraft;
import com.scriptcraft.core.Reference;
import com.scriptcraft.core.ServerThreads;
import com.scriptcraft.engine.ScriptResult;
import com.scriptcraft.filesystem.ScriptDirectories;
import com.scriptcraft.filesystem.ScriptFileManager;
import com.scriptcraft.util.ConsoleBuffer;
import com.scriptcraft.util.TextEditor;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.client.gui.GuiTextField;
import net.minecraftforge.fml.relauncher.Side;
import net.minecraftforge.fml.relauncher.SideOnly;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * The in-game IDE, opened with {@code K}.
 *
 * <pre>
 * ScriptCraft IDE
 * [Files] [Editor] [Console]        [Run] [Stop] [Save] [Reload]
 * +----------------------------------------------------------+
 * | files / editor / console                                  |
 * +----------------------------------------------------------+
 * status line
 * </pre>
 *
 * Rendering only - the text lives in {@link TextEditor} and every action goes through
 * {@link ScriptCraft#engine()} and {@link ScriptFileManager}, exactly like the /script command.
 * Script actions are posted to the server thread, because that is where world access is safe.
 */
@SideOnly(Side.CLIENT)
public class GuiScriptIde extends GuiScreen {

    private static final int MARGIN = 24;
    private static final int COLOR_BACKGROUND = 0xF0101014;
    private static final int COLOR_PANEL = 0xFF1B1B22;
    private static final int COLOR_BORDER = 0xFF3A3A48;
    private static final int COLOR_TEXT = 0xFFE0E0E0;
    private static final int COLOR_DIM = 0xFF9A9AA8;
    private static final int COLOR_SELECTED = 0xFF2E4A6B;

    private enum Tab { FILES, EDITOR, CONSOLE }

    private final TextEditor editor = new TextEditor();

    private Tab tab = Tab.FILES;
    private final List<String> files = new ArrayList<String>();
    private String currentFile;
    private int selectedFile = -1;
    private int fileScroll;
    private int consoleScroll;
    private boolean confirmDelete;
    private boolean confirmClose;
    private String status = "";

    private int contentTop;
    private int contentBottom;

    private GuiButton filesTab;
    private GuiButton editorTab;
    private GuiButton consoleTab;
    private GuiButton runButton;
    private GuiButton stopButton;
    private GuiButton saveButton;
    private GuiButton reloadButton;
    private GuiButton newButton;
    private GuiButton deleteButton;
    private GuiTextField newFileField;

    @Override
    public void initGui() {
        Keyboard.enableRepeatEvents(true);
        buttonList.clear();

        int rowY = MARGIN + 18;
        int x = MARGIN;
        filesTab = addButton(new GuiButton(1, x, rowY, 60, 20, "Files"));
        x += 64;
        editorTab = addButton(new GuiButton(2, x, rowY, 60, 20, "Editor"));
        x += 64;
        consoleTab = addButton(new GuiButton(3, x, rowY, 60, 20, "Console"));

        int right = width - MARGIN - 60;
        reloadButton = addButton(new GuiButton(13, right, rowY, 60, 20, "Reload"));
        right -= 64;
        saveButton = addButton(new GuiButton(12, right, rowY, 60, 20, "Save"));
        right -= 64;
        stopButton = addButton(new GuiButton(11, right, rowY, 60, 20, "Stop"));
        right -= 64;
        runButton = addButton(new GuiButton(10, right, rowY, 60, 20, "Run"));

        contentTop = rowY + 28;
        contentBottom = height - MARGIN - 22;

        newFileField = new GuiTextField(30, mc.fontRenderer, MARGIN + 6, contentBottom - 22, 150, 16);
        newFileField.setMaxStringLength(64);
        newButton = addButton(new GuiButton(20, MARGIN + 162, contentBottom - 23, 50, 18, "New"));
        deleteButton = addButton(new GuiButton(21, MARGIN + 216, contentBottom - 23, 60, 18, "Delete"));

        refreshFiles();
        updateTabButtons();
    }

    @Override
    public void onGuiClosed() {
        Keyboard.enableRepeatEvents(false);
    }

    @Override
    public boolean doesGuiPauseGame() {
        return false;
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawDefaultBackground();
        drawRect(MARGIN - 4, MARGIN - 4, width - MARGIN + 4, height - MARGIN + 4, COLOR_BACKGROUND);

        FontRenderer font = mc.fontRenderer;
        font.drawStringWithShadow(Reference.NAME + " IDE  -  " + Reference.VERSION, MARGIN, MARGIN - 1, 0xFFFFAA00);
        drawRect(MARGIN - 4, contentTop - 6, width - MARGIN + 4, contentBottom + 6, COLOR_PANEL);
        drawBorder();

        boolean filesTabActive = tab == Tab.FILES;
        newFileField.setVisible(filesTabActive);
        newButton.visible = filesTabActive;
        deleteButton.visible = filesTabActive;
        deleteButton.displayString = confirmDelete ? "Confirm?" : "Delete";

        if (filesTabActive) {
            drawFiles(font);
        } else if (tab == Tab.EDITOR) {
            drawEditor(font);
        } else {
            drawConsole(font);
        }

        String title = currentFile == null ? "no file open" : currentFile + (editor.isDirty() ? " *" : "");
        font.drawString(status, MARGIN, height - MARGIN - 12, 0xFFB8B8C8);
        font.drawString(title, width - MARGIN - font.getStringWidth(title), height - MARGIN - 12, COLOR_DIM);

        super.drawScreen(mouseX, mouseY, partialTicks);
    }

    private void drawBorder() {
        int left = MARGIN - 4;
        int right = width - MARGIN + 4;
        drawRect(left, contentTop - 6, right, contentTop - 5, COLOR_BORDER);
        drawRect(left, contentBottom + 5, right, contentBottom + 6, COLOR_BORDER);
        drawRect(left, contentTop - 6, left + 1, contentBottom + 6, COLOR_BORDER);
        drawRect(right - 1, contentTop - 6, right, contentBottom + 6, COLOR_BORDER);
    }

    private void drawFiles(FontRenderer font) {
        int y = contentTop;
        int lineHeight = font.FONT_HEIGHT + 2;
        if (files.isEmpty()) {
            font.drawString("No .js files in " + folderName(), MARGIN + 6, y + 4, COLOR_DIM);
            font.drawString("Type a name below and press New.", MARGIN + 6, y + 4 + lineHeight, COLOR_DIM);
        }
        for (int row = 0; row < visibleRows(lineHeight); row++) {
            int index = fileScroll + row;
            if (index >= files.size()) {
                break;
            }
            String name = files.get(index);
            int rowY = y + row * lineHeight;
            if (index == selectedFile) {
                drawRect(MARGIN + 2, rowY - 1, width - MARGIN - 2, rowY + lineHeight - 1, COLOR_SELECTED);
            }
            boolean running = ScriptCraft.engine().isRunning(name);
            font.drawString((running ? "> " : "  ") + name, MARGIN + 6, rowY, running ? 0xFF7FFF7F : COLOR_TEXT);
        }
        newFileField.drawTextBox();
    }

    private void drawEditor(FontRenderer font) {
        int lineHeight = font.FONT_HEIGHT + 1;
        int rows = visibleRows(lineHeight);
        int textX = MARGIN + 34;
        editor.ensureCursorVisible(rows, Math.max(10, (width - MARGIN - textX) / 6));

        for (int row = 0; row < rows; row++) {
            int lineIndex = editor.getScrollLine() + row;
            if (lineIndex >= editor.getLineCount()) {
                break;
            }
            int rowY = contentTop + row * lineHeight;
            String number = String.valueOf(lineIndex + 1);
            font.drawString(number, textX - 6 - font.getStringWidth(number), rowY, 0xFF6A6A78);

            String line = editor.getLine(lineIndex);
            String visible = line.length() > editor.getScrollColumn() ? line.substring(editor.getScrollColumn()) : "";
            font.drawString(visible, textX, rowY, COLOR_TEXT);
        }

        int cursorRow = editor.getCursorLine() - editor.getScrollLine();
        if (cursorRow >= 0 && cursorRow < rows) {
            String line = editor.getLine(editor.getCursorLine());
            int from = Math.min(editor.getScrollColumn(), line.length());
            int to = Math.min(editor.getCursorColumn(), line.length());
            int cx = textX + font.getStringWidth(line.substring(from, to));
            int cy = contentTop + cursorRow * lineHeight;
            drawRect(cx, cy, cx + 1, cy + font.FONT_HEIGHT, 0xFFFFFFFF);
        }

        if (currentFile == null) {
            font.drawString("Open a file from the Files tab first.", MARGIN + 6, contentTop + 4, COLOR_DIM);
        }
    }

    private void drawConsole(FontRenderer font) {
        List<String> lines = ConsoleBuffer.snapshot();
        int lineHeight = font.FONT_HEIGHT + 1;
        int rows = visibleRows(lineHeight);
        int end = Math.max(0, lines.size() - consoleScroll);
        int start = Math.max(0, end - rows);
        for (int i = start; i < end; i++) {
            String line = lines.get(i);
            int rowY = contentTop + (i - start) * lineHeight;
            font.drawString(font.trimStringToWidth(line, width - MARGIN * 2 - 8), MARGIN + 6, rowY, colorFor(line));
        }
        if (lines.isEmpty()) {
            font.drawString("No output yet. Run a script to see console.log() here.", MARGIN + 6, contentTop + 4, COLOR_DIM);
        }
    }

    private static int colorFor(String line) {
        if (line.contains("[ERROR]")) {
            return 0xFFFF7F7F;
        }
        if (line.contains("[WARN]")) {
            return 0xFFFFD27F;
        }
        return 0xFFC8C8D8;
    }

    private int visibleRows(int lineHeight) {
        return Math.max(1, (contentBottom - contentTop) / lineHeight);
    }

    private static String folderName() {
        return ScriptDirectories.scripts() == null ? "scriptcraft/scripts" : ScriptDirectories.scripts().getAbsolutePath();
    }

    // ---------------------------------------------------------------- input

    @Override
    protected void keyTyped(char typedChar, int keyCode) throws IOException {
        if (keyCode == Keyboard.KEY_ESCAPE) {
            if (editor.isDirty()) {
                status = "Unsaved changes - press Save, or Ctrl+Q to close anyway";
                if (confirmClose) {
                    mc.displayGuiScreen(null);
                }
                confirmClose = true;
                return;
            }
            mc.displayGuiScreen(null);
            return;
        }
        if (isCtrlKeyDown() && keyCode == Keyboard.KEY_S) {
            saveCurrent();
            return;
        }
        if (isCtrlKeyDown() && keyCode == Keyboard.KEY_Q) {
            mc.displayGuiScreen(null);
            return;
        }

        if (tab == Tab.FILES && newFileField.isFocused()) {
            newFileField.textboxKeyTyped(typedChar, keyCode);
            return;
        }
        if (tab == Tab.EDITOR && currentFile != null) {
            switch (keyCode) {
                case Keyboard.KEY_UP:
                    editor.moveUp();
                    return;
                case Keyboard.KEY_DOWN:
                    editor.moveDown();
                    return;
                case Keyboard.KEY_LEFT:
                    editor.moveLeft();
                    return;
                case Keyboard.KEY_RIGHT:
                    editor.moveRight();
                    return;
                case Keyboard.KEY_HOME:
                    editor.moveHome();
                    return;
                case Keyboard.KEY_END:
                    editor.moveEnd();
                    return;
                case Keyboard.KEY_BACK:
                    editor.backspace();
                    return;
                case Keyboard.KEY_DELETE:
                    editor.delete();
                    return;
                case Keyboard.KEY_RETURN:
                case Keyboard.KEY_NUMPADENTER:
                    editor.insertNewLine();
                    return;
                case Keyboard.KEY_TAB:
                    editor.insert("    ");
                    return;
                default:
                    editor.type(typedChar);
                    return;
            }
        }
        if (tab == Tab.FILES) {
            if (keyCode == Keyboard.KEY_UP) {
                selectFile(selectedFile - 1);
            } else if (keyCode == Keyboard.KEY_DOWN) {
                selectFile(selectedFile + 1);
            } else if (keyCode == Keyboard.KEY_RETURN || keyCode == Keyboard.KEY_NUMPADENTER) {
                openSelected();
            }
        }
    }

    @Override
    protected void mouseClicked(int mouseX, int mouseY, int mouseButton) throws IOException {
        super.mouseClicked(mouseX, mouseY, mouseButton);
        if (newFileField.getVisible()) {
            newFileField.mouseClicked(mouseX, mouseY, mouseButton);
        }
        if (mouseButton != 0 || mouseY < contentTop || mouseY > contentBottom) {
            return;
        }
        if (tab == Tab.FILES) {
            int lineHeight = mc.fontRenderer.FONT_HEIGHT + 2;
            int index = fileScroll + (mouseY - contentTop) / lineHeight;
            if (index >= 0 && index < files.size()) {
                if (index == selectedFile) {
                    openSelected();
                } else {
                    selectFile(index);
                }
            }
        } else if (tab == Tab.EDITOR && currentFile != null) {
            int lineHeight = mc.fontRenderer.FONT_HEIGHT + 1;
            int line = editor.getScrollLine() + (mouseY - contentTop) / lineHeight;
            String text = editor.getLine(line);
            int column = mc.fontRenderer.trimStringToWidth(text, mouseX - (MARGIN + 34)).length();
            editor.setCursor(line, column);
        }
    }

    @Override
    public void handleMouseInput() throws IOException {
        super.handleMouseInput();
        int wheel = Mouse.getEventDWheel();
        if (wheel == 0) {
            return;
        }
        int direction = wheel > 0 ? -3 : 3;
        if (tab == Tab.FILES) {
            fileScroll = Math.max(0, Math.min(fileScroll + direction, Math.max(0, files.size() - 1)));
        } else if (tab == Tab.CONSOLE) {
            consoleScroll = Math.max(0, Math.min(consoleScroll - direction, Math.max(0, ConsoleBuffer.snapshot().size() - 1)));
        } else if (tab == Tab.EDITOR) {
            editor.scroll(direction);
        }
    }

    @Override
    protected void actionPerformed(GuiButton button) throws IOException {
        switch (button.id) {
            case 1:
                setTab(Tab.FILES);
                break;
            case 2:
                setTab(Tab.EDITOR);
                break;
            case 3:
                setTab(Tab.CONSOLE);
                break;
            case 10:
                runCurrent();
                break;
            case 11:
                stopCurrent();
                break;
            case 12:
                saveCurrent();
                break;
            case 13:
                reloadCurrent();
                break;
            case 20:
                createNewFile();
                break;
            case 21:
                if (confirmDelete) {
                    deleteSelected();
                } else if (selectedFile >= 0) {
                    confirmDelete = true;
                    status = "Press Delete again to remove " + files.get(selectedFile);
                }
                break;
            default:
                break;
        }
    }

    // ---------------------------------------------------------------- actions

    private void setTab(Tab newTab) {
        tab = newTab;
        updateTabButtons();
    }

    private void updateTabButtons() {
        filesTab.displayString = label("Files", Tab.FILES);
        editorTab.displayString = label("Editor", Tab.EDITOR);
        consoleTab.displayString = label("Console", Tab.CONSOLE);
    }

    private String label(String text, Tab owner) {
        return tab == owner ? "> " + text : text;
    }

    private void refreshFiles() {
        String previous = currentFile;
        files.clear();
        files.addAll(ScriptFileManager.listScripts());
        selectedFile = previous == null ? -1 : files.indexOf(previous);
        if (selectedFile < 0 && !files.isEmpty()) {
            selectedFile = 0;
        }
    }

    private void selectFile(int index) {
        if (files.isEmpty()) {
            return;
        }
        selectedFile = Math.max(0, Math.min(index, files.size() - 1));
    }

    private void openSelected() {
        if (selectedFile < 0 || selectedFile >= files.size()) {
            return;
        }
        String name = files.get(selectedFile);
        try {
            editor.setText(ScriptFileManager.read(name));
            currentFile = name;
            status = "Opened " + name;
            setTab(Tab.EDITOR);
        } catch (IOException e) {
            status = e.getMessage();
        }
    }

    private void createNewFile() {
        String name = newFileField.getText().trim();
        if (name.isEmpty()) {
            status = "Enter a file name first, e.g. hello.js";
            return;
        }
        if (!ScriptFileManager.isScriptName(name)) {
            name = name + ScriptFileManager.EXTENSION;
        }
        try {
            ScriptFileManager.create(name);
            refreshFiles();
            selectedFile = files.indexOf(name);
            editor.setText("");
            currentFile = name;
            newFileField.setText("");
            status = "Created " + name;
        } catch (IOException e) {
            status = e.getMessage();
        }
    }

    private void deleteSelected() {
        if (selectedFile < 0 || selectedFile >= files.size()) {
            return;
        }
        String name = files.get(selectedFile);
        try {
            if (ScriptCraft.engine().isLoaded(name)) {
                ScriptCraft.engine().stop(name);
            }
            ScriptFileManager.delete(name);
            if (name.equals(currentFile)) {
                currentFile = null;
                editor.setText("");
            }
            refreshFiles();
            status = "Deleted " + name;
        } catch (IOException e) {
            status = e.getMessage();
        }
        confirmDelete = false;
    }

    private void saveCurrent() {
        if (currentFile == null) {
            status = "Nothing to save - open a file first";
            return;
        }
        try {
            ScriptFileManager.write(currentFile, editor.getText());
            editor.markSaved();
            status = "Saved " + currentFile;
        } catch (IOException e) {
            status = "Save failed: " + e.getMessage();
        }
    }

    private void runCurrent() {
        if (currentFile == null) {
            status = "Open a file first";
            return;
        }
        saveCurrent();
        final String file = currentFile;
        final EntityPlayerSP player = mc.player;
        status = "Running " + file + "...";
        setTab(Tab.CONSOLE);
        ServerThreads.run(new Runnable() {
            @Override
            public void run() {
                ScriptResult result = ScriptCraft.engine().run(file, player);
                status = result.isSuccess() ? result.getMessage() : "See console for the error";
            }
        });
    }

    private void stopCurrent() {
        if (currentFile == null) {
            status = "Open a file first";
            return;
        }
        final String file = currentFile;
        ServerThreads.run(new Runnable() {
            @Override
            public void run() {
                ScriptResult result = ScriptCraft.engine().stop(file);
                status = result.getMessage();
            }
        });
    }

    private void reloadCurrent() {
        if (currentFile == null) {
            status = "Open a file first";
            return;
        }
        saveCurrent();
        final String file = currentFile;
        final EntityPlayerSP player = mc.player;
        status = "Reloading " + file + "...";
        ServerThreads.run(new Runnable() {
            @Override
            public void run() {
                ScriptResult result = ScriptCraft.engine().reload(file, player);
                status = result.isSuccess() ? result.getMessage() : "See console for the error";
            }
        });
    }
}
