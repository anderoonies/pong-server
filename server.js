const WebSocket = require("ws");
const express = require("express");
const PORT = process.env.PORT || 8080;
const INDEX = "/index.html";

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new WebSocket.Server({ server });

let gameState = {};
let inputQueue = {};
let lastInputs = {};
let clientID = 0;

const setState = (clientID, state) => {
  gameState[clientID] = {
    ...state
  };
};

const enqueueAction = (clientID, action) => {
  inputQueue[clientID].push(action);
};

const processInputs = () => {
  Object.entries(inputQueue).forEach(([clientID, pendingInputs]) => {
    let lastProcessedIndex = -1;
    pendingInputs.forEach((input, i) => {
      gameState[clientID].y += input.dy;
      lastInputs[clientID] = input.id;
      lastProcessedIndex = i;
    });
    inputQueue[clientID].splice(0, lastProcessedIndex + 1);
    console.log(`removing ${lastProcessedIndex} processed inputs`);
  });
};

const broadcastState = () => {
  let state = [];
  wss.clients.forEach((client) => {
    state.push({
      ...gameState[client.id],
      clientID: client.id,
      lastInputID: lastInputs[client.id]
    });
  });
  wss.clients.forEach((client) => {
    client.send(JSON.stringify({ state, type: "state" }));
  });
};

wss.on("connection", (ws) => {
  ws.id = clientID++;
  inputQueue[ws.id] = [];
  gameState[ws.id] = { x: Math.random() * 400, y: 0 };
  lastInputs[ws.id] = 0;
  ws.send(
    JSON.stringify({
      type: "handshake",
      id: ws.id,
      initialState: gameState[ws.id]
    })
  );
  ws.on("message", (data) => {
    data = JSON.parse(data);
    if (data.type === "action") {
      enqueueAction(ws.id, data.action);
    }
  });
  ws.on("close", () => {
    gameState = Object.entries(gameState).reduce((acc, [k, v]) => {
      if (k !== ws.id.toString()) {
        acc[k] = v;
      }
      return acc;
    }, {});
  });
});

setInterval(() => {
  processInputs();
  broadcastState();
}, 1000 / 4);
