package com.scriptcraft.events;

import com.scriptcraft.api.EntityApi;
import com.scriptcraft.api.PlayerApi;
import com.scriptcraft.core.ScriptCraftConfig;
import com.scriptcraft.core.ScriptCraftLog;
import com.scriptcraft.engine.ScriptContext;
import com.scriptcraft.engine.ScriptError;
import com.scriptcraft.engine.ScriptState;
import com.scriptcraft.engine.TimerScheduler;
import com.scriptcraft.security.ScriptSandbox;
import net.minecraft.block.Block;
import net.minecraft.block.state.IBlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.util.ResourceLocation;
import net.minecraft.util.text.TextComponentString;
import net.minecraftforge.event.ServerChatEvent;
import net.minecraftforge.event.entity.EntityJoinWorldEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.world.BlockEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.PlayerEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;

import java.util.List;

/**
 * The only class in the mod that receives Forge events. It converts them into a
 * {@link ScriptEventObject} and hands that to the JavaScript listeners held by
 * {@link ScriptEventRegistry}.
 *
 * <p>Everything here runs on the server thread. Client-side worlds are ignored, and every
 * dispatch is limited by handler count and wall clock time so a heavy script cannot stall the
 * server tick.
 */
public final class EventBridge {

    private final ScriptEventRegistry registry;
    private final TimerScheduler timers;
    private long lastBudgetWarningTick = -1000L;

    public EventBridge(ScriptEventRegistry registry, TimerScheduler timers) {
        this.registry = registry;
        this.timers = timers;
    }

    @SubscribeEvent
    public void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_JOIN)) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.PLAYER_JOIN.getMethodName());
        object.setPlayer(new PlayerApi(event.player));
        dispatch(ScriptEventType.PLAYER_JOIN, object);
    }

    @SubscribeEvent
    public void onPlayerLoggedOut(PlayerEvent.PlayerLoggedOutEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_QUIT)) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.PLAYER_QUIT.getMethodName());
        object.setPlayer(new PlayerApi(event.player));
        dispatch(ScriptEventType.PLAYER_QUIT, object);
    }

    @SubscribeEvent
    public void onServerChat(ServerChatEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_CHAT)) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.PLAYER_CHAT.getMethodName());
        object.setPlayer(new PlayerApi(event.getPlayer()));
        object.setMessage(event.getMessage());
        dispatch(ScriptEventType.PLAYER_CHAT, object);

        if (object.isCanceled()) {
            event.setCanceled(true);
        } else if (object.getMessage() != null && !object.getMessage().equals(event.getMessage())) {
            event.setComponent(new TextComponentString(object.getMessage()));
        }
    }

    @SubscribeEvent
    public void onBlockBreak(BlockEvent.BreakEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_BREAK_BLOCK)) {
            return;
        }
        ScriptEventObject object = blockEvent(ScriptEventType.PLAYER_BREAK_BLOCK, event.getWorld().isRemote,
                event.getState(), event.getPos().getX(), event.getPos().getY(), event.getPos().getZ());
        if (object == null) {
            return;
        }
        object.setPlayer(new PlayerApi(event.getPlayer()));
        dispatch(ScriptEventType.PLAYER_BREAK_BLOCK, object);
        if (object.isCanceled()) {
            event.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void onBlockPlace(BlockEvent.EntityPlaceEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_PLACE_BLOCK)) {
            return;
        }
        ScriptEventObject object = blockEvent(ScriptEventType.PLAYER_PLACE_BLOCK, event.getWorld().isRemote,
                event.getState(), event.getPos().getX(), event.getPos().getY(), event.getPos().getZ());
        if (object == null) {
            return;
        }
        Entity placer = event.getEntity();
        if (placer instanceof EntityPlayer) {
            object.setPlayer(new PlayerApi((EntityPlayer) placer));
        }
        object.setEntity(new EntityApi(placer));
        dispatch(ScriptEventType.PLAYER_PLACE_BLOCK, object);
        if (object.isCanceled()) {
            event.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void onLivingDeath(LivingDeathEvent event) {
        if (!registry.hasListeners(ScriptEventType.PLAYER_DEATH)) {
            return;
        }
        Entity entity = event.getEntityLiving();
        if (entity.world.isRemote) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.PLAYER_DEATH.getMethodName());
        object.setEntity(new EntityApi(entity));
        if (entity instanceof EntityPlayer) {
            object.setPlayer(new PlayerApi((EntityPlayer) entity));
        }
        object.setCause(event.getSource().getDamageType());
        dispatch(ScriptEventType.PLAYER_DEATH, object);
        if (object.isCanceled()) {
            event.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void onEntityJoinWorld(EntityJoinWorldEvent event) {
        if (!registry.hasListeners(ScriptEventType.ENTITY_SPAWN) || event.getWorld().isRemote) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.ENTITY_SPAWN.getMethodName());
        Entity entity = event.getEntity();
        object.setEntity(new EntityApi(entity));
        object.setPosition(entity.posX, entity.posY, entity.posZ);
        dispatch(ScriptEventType.ENTITY_SPAWN, object);
        if (object.isCanceled()) {
            event.setCanceled(true);
        }
    }

    @SubscribeEvent
    public void onServerTick(TickEvent.ServerTickEvent event) {
        if (event.phase != TickEvent.Phase.END) {
            return;
        }
        timers.tick();
        if (!registry.hasListeners(ScriptEventType.TICK)) {
            return;
        }
        ScriptEventObject object = new ScriptEventObject(ScriptEventType.TICK.getMethodName());
        object.setTick(timers.getTick());
        dispatch(ScriptEventType.TICK, object);
    }

    private ScriptEventObject blockEvent(ScriptEventType type, boolean remote, IBlockState state, int x, int y, int z) {
        if (remote) {
            return null;
        }
        ScriptEventObject object = new ScriptEventObject(type.getMethodName());
        Block block = state.getBlock();
        ResourceLocation name = Block.REGISTRY.getNameForObject(block);
        object.setBlock(name == null ? "unknown" : name.toString());
        object.setBlockMeta(block.getMetaFromState(state));
        object.setPosition(x, y, z);
        return object;
    }

    /** Runs every listener of one event type with a shared handler and time budget. */
    private void dispatch(ScriptEventType type, ScriptEventObject event) {
        List<ScriptEventRegistry.Listener> listeners = registry.get(type);
        long deadline = System.currentTimeMillis() + ScriptCraftConfig.maxTickMillisPerTick;
        int handled = 0;

        for (ScriptEventRegistry.Listener listener : listeners) {
            ScriptContext context = listener.getContext();
            if (context.getState() != ScriptState.RUNNING) {
                continue;
            }
            if (handled >= ScriptCraftConfig.maxTickHandlersPerTick || System.currentTimeMillis() >= deadline) {
                warnBudget(type);
                return;
            }
            handled++;
            try {
                ScriptSandbox.invoke(context.getEngine(), listener.getCallback(), event);
            } catch (Throwable t) {
                ScriptError error = ScriptError.of(context.getName(), t);
                context.setLastError(error);
                ScriptCraftLog.error("Listener " + type.getMethodName() + " in " + context.getName() + " failed\n"
                        + error.format());
            }
        }
    }

    private void warnBudget(ScriptEventType type) {
        long tick = timers.getTick();
        if (tick - lastBudgetWarningTick < 200L) {
            return;
        }
        lastBudgetWarningTick = tick;
        ScriptCraftLog.warn("Event " + type.getMethodName() + " exceeded the handler/time budget "
                + "(tick.maxHandlersPerTick=" + ScriptCraftConfig.maxTickHandlersPerTick
                + ", tick.maxMillisPerTick=" + ScriptCraftConfig.maxTickMillisPerTick + "); remaining listeners skipped");
    }
}
