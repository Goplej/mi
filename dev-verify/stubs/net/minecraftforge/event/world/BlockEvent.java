// COMPILE-TIME STAND-IN for Forge 1.12.2 (14.23.5.x). Signatures mirror the real Forge source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraftforge.event.world;

import net.minecraft.block.state.IBlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import net.minecraftforge.fml.common.eventhandler.Cancelable;
import net.minecraftforge.fml.common.eventhandler.Event;

public class BlockEvent extends Event {
    private final World world;
    private final BlockPos pos;
    private final IBlockState state;

    public BlockEvent(World world, BlockPos pos, IBlockState state) {
        this.world = world; this.pos = pos; this.state = state;
    }

    public World getWorld() { return world; }
    public BlockPos getPos() { return pos; }
    public IBlockState getState() { return state; }

    @Cancelable
    public static class BreakEvent extends BlockEvent {
        private final EntityPlayer player;

        public BreakEvent(World world, BlockPos pos, IBlockState state, EntityPlayer player) {
            super(world, pos, state);
            this.player = player;
        }

        public EntityPlayer getPlayer() { return player; }
    }

    public static class EntityPlaceEvent extends BlockEvent {
        private final Entity entity;

        public EntityPlaceEvent(World world, BlockPos pos, IBlockState state, Entity entity) {
            super(world, pos, state);
            this.entity = entity;
        }

        public Entity getEntity() { return entity; }
    }

    @Cancelable
    public static class PlaceEvent extends EntityPlaceEvent {
        private final EntityPlayer player;

        public PlaceEvent(World world, BlockPos pos, IBlockState state, EntityPlayer player) {
            super(world, pos, state, player);
            this.player = player;
        }

        public EntityPlayer getPlayer() { return player; }
    }
}
