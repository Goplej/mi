// Greets everyone who joins the server.
// Run it with:  /script run welcome.js   (leave it running)

events.onPlayerJoin(function (event) {
    event.player.sendMessage("Welcome, " + event.player.getName() + "!");
    console.log(event.player.getName() + " joined the game");
});

events.onPlayerQuit(function (event) {
    console.log(event.player.getName() + " left the game");
});
