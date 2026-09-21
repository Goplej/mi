// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.block.state;

import net.minecraft.block.Block;

public class IBlockState {
    private final Block block;
    private final int meta;

    public IBlockState(Block blockIn) { this(blockIn, 0); }
    public IBlockState(Block blockIn, int metaIn) { this.block = blockIn; this.meta = metaIn; }

    public Block getBlock() { return block; }
    public int meta() { return meta; }
    public String toString() { return block.getLocalizedName() + "[" + meta + "]"; }
}
