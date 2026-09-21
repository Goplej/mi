package com.scriptcraft.util;

import java.util.ArrayList;
import java.util.List;

/**
 * Line based text buffer with a cursor and scrolling - the model behind the IDE editor.
 *
 * <p>It knows nothing about rendering, which keeps it usable from tests and makes it possible to
 * add line numbers, search or syntax highlighting later without touching the logic here.
 */
public final class TextEditor {

    private final List<String> lines = new ArrayList<String>();

    private int cursorLine;
    private int cursorColumn;
    private int scrollLine;
    private int scrollColumn;
    private boolean dirty;

    public TextEditor() {
        lines.add("");
    }

    public void setText(String text) {
        lines.clear();
        String value = text == null ? "" : text.replace("\r\n", "\n").replace('\r', '\n');
        int start = 0;
        for (int i = 0; i <= value.length(); i++) {
            if (i == value.length() || value.charAt(i) == '\n') {
                lines.add(value.substring(start, i));
                start = i + 1;
            }
        }
        if (lines.isEmpty()) {
            lines.add("");
        }
        cursorLine = 0;
        cursorColumn = 0;
        scrollLine = 0;
        scrollColumn = 0;
        dirty = false;
    }

    public String getText() {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < lines.size(); i++) {
            if (i > 0) {
                builder.append('\n');
            }
            builder.append(lines.get(i));
        }
        return builder.toString();
    }

    public List<String> getLines() {
        return new ArrayList<String>(lines);
    }

    public int getLineCount() {
        return lines.size();
    }

    public String getLine(int index) {
        if (index < 0 || index >= lines.size()) {
            return "";
        }
        return lines.get(index);
    }

    public int getCursorLine() {
        return cursorLine;
    }

    public int getCursorColumn() {
        return cursorColumn;
    }

    public void setCursor(int line, int column) {
        cursorLine = clamp(line, 0, lines.size() - 1);
        cursorColumn = clamp(column, 0, getLine(cursorLine).length());
    }

    public void moveUp() {
        setCursor(cursorLine - 1, cursorColumn);
    }

    public void moveDown() {
        setCursor(cursorLine + 1, cursorColumn);
    }

    public void moveLeft() {
        if (cursorColumn > 0) {
            cursorColumn--;
        } else if (cursorLine > 0) {
            cursorLine--;
            cursorColumn = getLine(cursorLine).length();
        }
    }

    public void moveRight() {
        if (cursorColumn < getLine(cursorLine).length()) {
            cursorColumn++;
        } else if (cursorLine < lines.size() - 1) {
            cursorLine++;
            cursorColumn = 0;
        }
    }

    public void moveHome() {
        cursorColumn = 0;
    }

    public void moveEnd() {
        cursorColumn = getLine(cursorLine).length();
    }

    /** Inserts one typed character; {@code '\n'} breaks the line, {@code '\t'} inserts four spaces. */
    public void type(char character) {
        if (character == '\n') {
            insertNewLine();
        } else if (character == '\t') {
            insert("    ");
        } else if (character >= ' ') {
            insert(String.valueOf(character));
        }
    }

    public void insert(String text) {
        if (text == null || text.isEmpty()) {
            return;
        }
        if (text.indexOf('\n') >= 0) {
            for (char character : text.toCharArray()) {
                type(character);
            }
            return;
        }
        String line = getLine(cursorLine);
        lines.set(cursorLine, line.substring(0, cursorColumn) + text + line.substring(cursorColumn));
        cursorColumn += text.length();
        dirty = true;
    }

    public void insertNewLine() {
        String line = getLine(cursorLine);
        String rest = line.substring(cursorColumn);
        lines.set(cursorLine, line.substring(0, cursorColumn));
        lines.add(cursorLine + 1, rest);
        cursorLine++;
        cursorColumn = 0;
        dirty = true;
    }

    public void backspace() {
        if (cursorColumn > 0) {
            String line = getLine(cursorLine);
            lines.set(cursorLine, line.substring(0, cursorColumn - 1) + line.substring(cursorColumn));
            cursorColumn--;
            dirty = true;
        } else if (cursorLine > 0) {
            String previous = getLine(cursorLine - 1);
            String current = getLine(cursorLine);
            lines.set(cursorLine - 1, previous + current);
            lines.remove(cursorLine);
            cursorLine--;
            cursorColumn = previous.length();
            dirty = true;
        }
    }

    public void delete() {
        String line = getLine(cursorLine);
        if (cursorColumn < line.length()) {
            lines.set(cursorLine, line.substring(0, cursorColumn) + line.substring(cursorColumn + 1));
            dirty = true;
        } else if (cursorLine < lines.size() - 1) {
            String next = getLine(cursorLine + 1);
            lines.set(cursorLine, line + next);
            lines.remove(cursorLine + 1);
            dirty = true;
        }
    }

    public int getScrollLine() {
        return scrollLine;
    }

    public int getScrollColumn() {
        return scrollColumn;
    }

    public void setScrollLine(int line) {
        scrollLine = clamp(line, 0, Math.max(0, lines.size() - 1));
    }

    public void scroll(int deltaLines) {
        setScrollLine(scrollLine + deltaLines);
    }

    /** Keeps the cursor inside the visible window; call before rendering. */
    public void ensureCursorVisible(int visibleRows, int visibleColumns) {
        if (cursorLine < scrollLine) {
            scrollLine = cursorLine;
        } else if (cursorLine >= scrollLine + visibleRows) {
            scrollLine = cursorLine - visibleRows + 1;
        }
        if (cursorColumn < scrollColumn) {
            scrollColumn = cursorColumn;
        } else if (cursorColumn >= scrollColumn + visibleColumns) {
            scrollColumn = cursorColumn - visibleColumns + 1;
        }
        scrollLine = Math.max(0, scrollLine);
        scrollColumn = Math.max(0, scrollColumn);
    }

    public boolean isDirty() {
        return dirty;
    }

    public void markSaved() {
        dirty = false;
    }

    private static int clamp(int value, int min, int max) {
        return value < min ? min : (value > max ? max : value);
    }
}
