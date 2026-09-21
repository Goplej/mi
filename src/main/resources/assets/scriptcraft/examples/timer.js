// A one-shot timer and a repeating timer that cancels itself.

timer.after(500, function () {
    console.log("Half a second has passed");
});

var runs = 0;
var id = timer.every(1000, function () {
    runs++;
    player.sendActionBar("ScriptCraft timer: " + runs + "/5");
    if (runs >= 5) {
        timer.cancel(id);
        console.log("Timer finished after " + runs + " runs");
    }
});

console.log("Timers scheduled: " + timer.active());
