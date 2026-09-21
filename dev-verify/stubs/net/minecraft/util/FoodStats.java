// COMPILE-TIME STAND-IN for Minecraft 1.12.2 (MCP stable_39). Signatures mirror the real source;
// behaviour is faked so the mod can be compiled and exercised headlessly. Not part of the mod jar.
package net.minecraft.util;

public class FoodStats {
    private int foodLevel = 20;

    public int getFoodLevel() { return foodLevel; }
    public void setFoodLevel(int foodLevelIn) { this.foodLevel = foodLevelIn; }
}
