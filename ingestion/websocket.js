const WebSocket = require("ws");

const wss = new WebSocket.Server({
    port: 8080
});

console.log("WebSocket server running on port 8080");

wss.on("connection", (socket) => {
    console.log("Dashboard connected");

    socket.send(JSON.stringify({
        type: "connected",
        message: "Connected to TraceFlow"
    }));

    socket.on("close", () => {
        console.log("Dashboard disconnected");
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

module.exports = {
    broadcast
};
