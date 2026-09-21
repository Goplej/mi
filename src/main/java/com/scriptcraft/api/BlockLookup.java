package com.scriptcraft.api;

import net.minecraft.block.Block;
import net.minecraft.block.state.IBlockState;

/**
 * Converts the strings scripts use into 1.12.2 block states.
 *
 * <p>Accepted forms: {@code "stone"}, {@code "minecraft:stone"}, {@code "minecraft:stone:1"},
 * {@code "log:2"} and plain numeric ids such as {@code "1"}.
 */
final class BlockLookup {

    private BlockLookup() {
    }

    static IBlockState lookup(String name, int meta) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Block name is empty");
        }
        String value = name.trim();
        int metaFromName = meta;

        // "minecraft:stone:1" -> name plus metadata
        int lastColon = value.lastIndexOf(':');
        if (lastColon > 0 && lastColon < value.length() - 1 && isDigits(value.substring(lastColon + 1))) {
            String maybeDomain = value.substring(0, lastColon);
            if (maybeDomain.indexOf(':') >= 0 || !maybeDomain.contains(".")) {
                metaFromName = Integer.parseInt(value.substring(lastColon + 1));
                value = maybeDomain;
            }
        }

        Block block = Block.getBlockFromName(value);
        if (block == null) {
            throw new IllegalArgumentException("Unknown block: " + name);
        }
        IBlockState state = block.getDefaultState();
        if (metaFromName != 0) {
            try {
                state = stateForMeta(block, metaFromName);
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("Invalid metadata " + metaFromName + " for " + name);
            }
        }
        return state;
    }

    /**
     * Turns a numeric metadata value into the state the block expects.
     *
     * <p>{@code Block.getStateFromMeta} is deprecated in 1.12.2 - Forge would rather mods
     * address state properties by name - but a script that writes {@code "minecraft:log:2"}
     * only has a number, and this is the only mapping from a number to a state, the same one
     * the game itself uses when it loads a chunk.
     */
    @SuppressWarnings("deprecation")
    private static IBlockState stateForMeta(Block block, int meta) {
        return block.getStateFromMeta(meta);
    }

    static int idOf(String name) {
        Block block = Block.getBlockFromName(String.valueOf(name).trim());
        return block == null ? -1 : Block.getIdFromBlock(block);
    }

    static boolean exists(String name) {
        return Block.getBlockFromName(String.valueOf(name).trim()) != null;
    }

    private static boolean isDigits(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return !value.isEmpty();
    }
}
