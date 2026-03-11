const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// estructura de salas
const rooms = {};

io.on("connection", (socket) => {

  socket.on("join-room", (data) => {
    const room = data.room;
    const nick = data.nick;

    socket.join(room);
    socket.room = room;
    socket.nick = nick;

    if (!rooms[room]) {
      rooms[room] = {
        history: [],
        users: {}
      };
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
    if (rooms[room].history.length > 100) {
      rooms[room].history.shift();
    }

    io.to(room).emit("message", msg);
  });

  // borrar chat
  socket.on("delete-chat", (data) => {
    const room = data.room;
    const code = data.code;

    if (code !== "dani301") return;

    if (rooms[room]) {
      rooms[room].history = [];
    }

    io.to(room).emit("chat-deleted");
  });

  // desconectar usuario
  socket.on("disconnect", () => {
    const room = socket.room;
    const nick = socket.nick;

    if (!room || !rooms[room]) return;

    delete rooms[room].users[socket.id];

    // avisar a los demás que alguien se fue
    socket.to(room).emit("user-left", nick);

    // actualizar lista de usuarios conectados
    io.to(room).emit("update-users", Object.values(rooms[room].users));
  });

});

server.listen(3000, () => {
  console.log("server running on port 3000");
});