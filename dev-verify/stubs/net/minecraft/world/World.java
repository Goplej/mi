// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.world;

import net.minecraft.block.Block;
import net.minecraft.block.state.IBlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.storage.WorldInfo;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class World {
    public final WorldProvider provider = new WorldProvider();
    public final List<EntityPlayer> playerEntities = new ArrayList<EntityPlayer>();
    public final boolean isRemote;

    private final WorldInfo worldInfo = new WorldInfo();
    private final Map<BlockPos, IBlockState> blocks = new HashMap<BlockPos, IBlockState>();
    private final List<Entity> loadedEntities = new ArrayList<Entity>();
    private long worldTime;
    private int height = 256;

    public World() { this(false); }
    public World(boolean client) { this.isRemote = client; }

    public IBlockState getBlockState(BlockPos pos) {
        IBlockState state = blocks.get(pos);
        return state == null ? Block.getBlockById(0).getDefaultState() : state;
    }

    public boolean setBlockState(BlockPos pos, IBlockState state) { return setBlockState(pos, state, 3); }

    public boolean setBlockState(BlockPos pos, IBlockState newState, int flags) {
        if (pos.getY() < 0 || pos.getY() >= height) {
            return false;
        }
        IBlockState previous = blocks.put(pos, newState);
        return previous != newState;
    }

    public boolean isAirBlock(BlockPos pos) { return getBlockState(pos).getBlock() == Block.getBlockById(0); }
    public WorldInfo getWorldInfo() { return worldInfo; }
    public List<Entity> getLoadedEntityList() { return loadedEntities; }
    public long getWorldTime() { return worldTime; }
    public void setWorldTime(long time) { this.worldTime = time; }
    public int getHeight() { return height; }
    public boolean spawnEntity(Entity entityIn) { return loadedEntities.add(entityIn); }

    // harness helpers
    public void addLoadedEntity(Entity entity) { loadedEntities.add(entity); }
    public void setHeight(int value) { this.height = value; }
}
