// Chat filtering plus a block-break report.

events.onPlayerChat(function (event) {
    if (event.getMessage().indexOf("spam") >= 0) {
        event.cancel();
        event.getPlayer().sendMessage("No spam here.");
        console.log("Blocked spam from " + event.getPlayer().getName());
    }
});

events.onPlayerBreakBlock(function (event) {
    console.log(event.getPlayer().getName() + " broke " + event.getBlock()
        + " at " + event.getX() + "," + event.getY() + "," + event.getZ());
});

events.onPlayerDeath(function (event) {
    console.log("Something died: " + event.getEntity().getType()
        + " (cause: " + event.getCause() + ")");
});
