// ScriptCraft self test:  /script run test.js
// Prints OK or FAIL for every part of the API.

function report(label, ok) {
    console.log(label + ": " + (ok ? "OK" : "FAIL"));
    return ok;
}

console.log("[ScriptCraft Test]");

var engineOk = false;
try {
    engineOk = (1 + 1) === 2;
} catch (e) {
    engineOk = false;
}
report("Engine", engineOk);

var playerOk = false;
try {
    playerOk = player.getName().length > 0 && typeof player.getX() === "number" && player.getHealth() >= 0;
} catch (e) {
    playerOk = false;
}
report("Player API", playerOk);

var worldOk = false;
try {
    world.setBlock(0, 5, 0, "minecraft:stone");
    worldOk = blocks.nameAt(0, 5, 0) === "minecraft:stone" && world.getName().length > 0;
} catch (e) {
    worldOk = false;
}
report("World API", worldOk);

var eventsOk = false;
try {
    events.onTick(function (event) {
        // registered only to prove the hook exists
    });
    eventsOk = events.listenerCount() > 0;
} catch (e) {
    eventsOk = false;
}
report("Events", eventsOk);

var timersOk = false;
try {
    var id = timer.after(50, function () {
        console.log("timer fired");
    });
    timersOk = id > 0;
    timer.cancel(id);
} catch (e) {
    timersOk = false;
}
report("Timers", timersOk);

var errorsOk = false;
try {
    undefinedVariable.foo();
} catch (e) {
    errorsOk = true;
}
report("Error handling", errorsOk);
