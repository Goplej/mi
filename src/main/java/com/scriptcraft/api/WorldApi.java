package com.scriptcraft.api;

import com.scriptcraft.core.GameRefs;
import net.minecraft.block.Block;
import net.minecraft.block.state.IBlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.util.ResourceLocation;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

import java.util.ArrayList;
import java.util.List;

/**
 * {@code world} - blocks, entities and players of the world the script runs in.
 *
 * <p>The world is resolved on every call from the script owner, so a player who moves to the
 * Nether keeps working on the world they are in.
 */
public final class WorldApi {

    private final Object owner;

    /** @param owner the player that started the script, or {@code null} to use the server world */
    public WorldApi(Object owner) {
        this.owner = owner;
    }

    public boolean isAvailable() {
        return world() != null;
    }

    public boolean isClient() {
        World world = world();
        return world != null && world.isRemote;
    }

    public String getName() {
        World world = require();
        return world.getWorldInfo().getWorldName();
    }

    public int getDimension() {
        return require().provider.getDimensionType().getId();
    }

    public long getTime() {
        return require().getWorldTime();
    }

    public void setTime(long time) {
        require().setWorldTime(time);
    }

    public int getMaxHeight() {
        return require().getHeight();
    }

    public BlockInfo getBlock(double x, double y, double z) {
        World world = require();
        BlockPos pos = new BlockPos((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
        IBlockState state = world.getBlockState(pos);
        Block block = state.getBlock();
        ResourceLocation name = Block.REGISTRY.getNameForObject(block);
        return new BlockInfo(
                name == null ? "unknown" : name.toString(),
                block.getMetaFromState(state),
                pos.getX(), pos.getY(), pos.getZ());
    }

    /** {@code world.setBlock(100, 64, 100, "minecraft:stone")} */
    public boolean setBlock(double x, double y, double z, String blockName) {
        return setBlock(x, y, z, blockName, 0);
    }

    /** {@code world.setBlock(100, 64, 100, "minecraft:stone", 1)} */
    public boolean setBlock(double x, double y, double z, String blockName, int meta) {
        World world = require();
        BlockPos pos = new BlockPos((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
        if (!inBounds(world, pos)) {
            return false;
        }
        IBlockState state = BlockLookup.lookup(blockName, meta);
        return world.setBlockState(pos, state);
    }

    public boolean isAir(double x, double y, double z) {
        World world = require();
        BlockPos pos = new BlockPos((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
        return world.isAirBlock(pos);
    }

    public int getBlockId(double x, double y, double z) {
        World world = require();
        BlockPos pos = new BlockPos((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
        return Block.getIdFromBlock(world.getBlockState(pos).getBlock());
    }

    public List<PlayerApi> getPlayers() {
        List<PlayerApi> players = new ArrayList<PlayerApi>();
        World world = require();
        for (EntityPlayer player : world.playerEntities) {
            players.add(new PlayerApi(player));
        }
        return players;
    }

    /**
     * Every loaded entity. This can be a large list in a busy world - prefer
     * {@link #getEntitiesNear(double, double, double, double)} or {@code entities.getNearby()}.
     */
    public List<EntityApi> getEntities() {
        List<EntityApi> entities = new ArrayList<EntityApi>();
        for (Entity entity : require().getLoadedEntityList()) {
            entities.add(new EntityApi(entity));
        }
        return entities;
    }

    public List<EntityApi> getEntitiesNear(double x, double y, double z, double radius) {
        List<EntityApi> result = new ArrayList<EntityApi>();
        double squared = radius * radius;
        for (Entity entity : require().getLoadedEntityList()) {
            double dx = entity.posX - x;
            double dy = entity.posY - y;
            double dz = entity.posZ - z;
            if (dx * dx + dy * dy + dz * dz <= squared) {
                result.add(new EntityApi(entity));
            }
        }
        return result;
    }

    /** Replaces World.isValid, which is private in 1.12.2. */
    private static boolean inBounds(World world, BlockPos pos) {
        return pos.getY() >= 0 && pos.getY() < world.getHeight()
                && Math.abs(pos.getX()) < 30000000 && Math.abs(pos.getZ()) < 30000000;
    }

    private World require() {
        World world = world();
        if (world == null) {
            throw new IllegalStateException("No world available. Scripts need a running world - join one first.");
        }
        return world;
    }

    private World world() {
        return GameRefs.worldFor(owner);
    }
}
