// Reads and writes blocks around the player.

var x = player.getBlockX();
var y = player.getBlockY();
var z = player.getBlockZ();

world.setBlock(x, y - 1, z, "minecraft:stone");
world.setBlock(x + 1, y - 1, z, "minecraft:stone:1");

var under = world.getBlock(x, y - 1, z);
var next = blocks.get(x + 1, y - 1, z);

console.log("Under you: " + under.getName() + " meta " + under.getMeta());
console.log("Next to it: " + next + " (id " + blocks.idOf(next.getName()) + ")");
console.log("Air above you: " + world.isAir(x, y + 2, z));

player.sendMessage("Stone platform built at " + x + "," + (y - 1) + "," + z);
