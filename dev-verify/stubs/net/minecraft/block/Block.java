// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.block;

import net.minecraft.block.state.IBlockState;
import net.minecraft.util.ResourceLocation;
import net.minecraft.util.registry.RegistryNamespaced;

import java.util.ArrayList;
import java.util.List;

public class Block {
    public static final RegistryNamespaced<ResourceLocation, Block> REGISTRY =
            new RegistryNamespaced<ResourceLocation, Block>();
    private static final List<Block> BY_ID = new ArrayList<Block>();
    private static final Block AIR = register("minecraft:air");

    private final String name;
    private final IBlockState defaultState = new IBlockState(this, 0);

    public Block(String registryName) { this.name = registryName; }

    public static Block register(String registryName) {
        Block block = new Block(registryName);
        REGISTRY.putObject(new ResourceLocation(registryName), block);
        BY_ID.add(block);
        return block;
    }

    public static Block getBlockFromName(String name) {
        ResourceLocation key = new ResourceLocation(name);
        Block block = REGISTRY.getObject(key);
        if (block != null) {
            return block;
        }
        try {
            int id = Integer.parseInt(name.trim());
            return id >= 0 && id < BY_ID.size() ? BY_ID.get(id) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static int getIdFromBlock(Block blockIn) { return BY_ID.indexOf(blockIn); }
    public static Block getBlockById(int id) { return id >= 0 && id < BY_ID.size() ? BY_ID.get(id) : AIR; }

    public final IBlockState getDefaultState() { return defaultState; }
    /** Deprecated in the real 1.12.2 sources; mirrored here so the rig reports callers. */
    @Deprecated
    public IBlockState getStateFromMeta(int meta) { return new IBlockState(this, meta); }
    public int getMetaFromState(IBlockState state) { return state.meta(); }
    public String getLocalizedName() { return name; }
    public String toString() { return "Block{" + name + "}"; }
}
