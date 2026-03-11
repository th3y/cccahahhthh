// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// ruta para guardar historial
const DATA_FILE = path.join(__dirname, "rooms.json");

// -------------------- UTIL --------------------
function loadRooms() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error leyendo rooms.json:", err);
  }
  return {};
}

function saveRooms(rooms) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
  } catch (err) {
    console.error("Error guardando rooms.json:", err);
  }
}

// -------------------- ROOMS --------------------
let rooms = loadRooms();

// cada 15s guardar historial automáticamente
setInterval(() => {
  saveRooms(rooms);
}, 15000);

// -------------------- SOCKET.IO --------------------
io.on("connection", (socket) => {

  socket.on("join-room", (data) => {
    const room = data.room;
    const nick = data.nick;

    socket.join(room);
    socket.room = room;
    socket.nick = nick;

    if (!rooms[room]) {
      rooms[room] = { history: [], users: {} };
    }

    rooms[room].users[socket.id] = nick;

    // enviar historial solo al usuario que entra
    socket.emit("history", rooms[room].history);

    // avisar a los demás que alguien entró
    socket.to(room).emit("user-joined", nick);

    // actualizar lista de usuarios conectados para todos
    io.to(room).emit("update-users", Object.values(rooms[room].users));
  });

  // manejar mensaje nuevo
  socket.on("message", (data) => {
    const room = data.room;
    if (!rooms[room]) return;

    const msg = {
      id: data.id,
      nick: data.nick,
      text: data.text,
      time: data.time
    };

    rooms[room].history.push(msg);

    // limitar historial a 100 mensajes
    if (rooms[room].history.length > 100) rooms[room].history.shift();

    io.to(room).emit("message", msg);
  });

  // borrar chat (si tienes código)
  socket.on("delete-chat", (data) => {
    const room = data.room;
    const code = data.code;
    if (code !== "dani301") return;
    if (rooms[room]) rooms[room].history = [];
    io.to(room).emit("chat-deleted");
  });

  // responder ping del cliente
  socket.on("ping-check", (data) => {
    socket.emit("pong-check", { nick: socket.nick, room: socket.room });
  });

  // desconectar usuario
  socket.on("disconnect", () => {
    const room = socket.room;
    const nick = socket.nick;

    if (!room || !rooms[room]) return;

    delete rooms[room].users[socket.id];

    // avisar a los demás
    socket.to(room).emit("user-left", nick);

    // actualizar lista de usuarios conectados
    io.to(room).emit("update-users", Object.values(rooms[room].users));
  });

});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});