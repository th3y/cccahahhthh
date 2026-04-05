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

// -------------------- CONFIG --------------------
const VALID_CODES = (process.env.VALID_CODES || "").split(",").map(c => c.trim()).filter(Boolean);
const DELETE_CODE = process.env.DELETE_CODE;
const MIN_INTERVAL_MS = 450;
const MAX_HISTORY = 45;

// Guardar fotos en historial del servidor (true = sí, false = efímeras siempre)
const PHOTO_SAVE_IN_HISTORY = false;

// -------------------- UTIL --------------------
const DATA_FILE = path.join(__dirname, "rooms.json");

function loadRooms() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      for (const room of Object.values(data)) {
        if (room.history && room.history.length > MAX_HISTORY) {
          room.history = room.history.slice(-MAX_HISTORY);
        }
      }
      return data;
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

// -------------------- RATE LIMITER --------------------
const rateLimitMap = new Map();

function initRateLimit(socketId) {
  rateLimitMap.set(socketId, 0);
}

function checkRateLimit(socketId) {
  const now = Date.now();
  const last = rateLimitMap.get(socketId) || 0;
  if (now - last < MIN_INTERVAL_MS) return false;
  rateLimitMap.set(socketId, now);
  return true;
}

// -------------------- ROOMS --------------------
let rooms = loadRooms();

// Guardado periódico cada 15s
setInterval(() => {
  saveRooms(rooms);
}, 15000);

// -------------------- SOCKET.IO --------------------
io.on("connection", (socket) => {

  // ---------- VALIDAR CÓDIGO ----------
  socket.on("validate-code", (data, callback) => {
    const { code } = data;
    if (VALID_CODES.length === 0) {
      return callback({ ok: false, reason: "no_codes_configured" });
    }
    if (!VALID_CODES.includes(code)) {
      return callback({ ok: false, reason: "invalid_code" });
    }
    callback({ ok: true });
  });

  // ---------- JOIN ROOM ----------
  socket.on("join-room", (data) => {
    const { room, nick } = data;
    socket.join(room);
    socket.room = room;
    socket.nick = nick;

    initRateLimit(socket.id);

    if (!rooms[room]) {
      rooms[room] = { history: [], users: {} };
    }
    rooms[room].users[socket.id] = nick;

    socket.emit("history", rooms[room].history.slice(-MAX_HISTORY));
    socket.to(room).emit("user-joined", nick);
    io.to(room).emit("update-users", Object.values(rooms[room].users));
  });

  // ---------- MENSAJE ----------
  socket.on("message", (data) => {
    const room = data.room;
    if (!rooms[room]) return;

    if (!checkRateLimit(socket.id)) {
      socket.emit("rate-limited", { reason: "Demasiados mensajes. Espera un momento." });
      return;
    }

    // Mensajes autodestructivos: no se guardan en historial
    if (data.selfDestruct) {
      const msg = {
        id: data.id,
        nick: data.nick,
        text: data.text,
        time: data.time,
        replyTo: data.replyTo || null,
        selfDestruct: true,
        sdSeconds: data.sdSeconds || 7
      };
      io.to(room).emit("message", msg);
      return;
    }

    const msg = {
      id: data.id,
      nick: data.nick,
      text: data.text,
      time: data.time,
      replyTo: data.replyTo || null
    };

    rooms[room].history.push(msg);
    while (rooms[room].history.length > MAX_HISTORY) rooms[room].history.shift();
    io.to(room).emit("message", msg);
  });

  // ---------- FOTO (ephemeral — nunca se guarda en historial) ----------
  socket.on("photo", (data) => {
    const room = data.room;
    if (!rooms[room]) return;
    if (!checkRateLimit(socket.id)) {
      socket.emit("rate-limited", { reason: "Demasiados mensajes. Espera un momento." });
      return;
    }
    if (!data.data || typeof data.data !== "string") return;
    if (!data.data.startsWith("data:image/")) return;
    if (data.data.length > 2_000_000) {
      socket.emit("rate-limited", { reason: "Foto demasiado grande." });
      return;
    }
    const msg = {
      id: data.id,
      nick: data.nick,
      time: data.time,
      replyTo: data.replyTo || null,
      photo: data.data,
      selfDestruct: data.selfDestruct || false,
      sdSeconds: data.sdSeconds || 7
    };
    if (PHOTO_SAVE_IN_HISTORY && !msg.selfDestruct) {
      rooms[room].history.push(msg);
      while (rooms[room].history.length > MAX_HISTORY) rooms[room].history.shift();
    } else if (!PHOTO_SAVE_IN_HISTORY && !msg.selfDestruct) {
      // Rastro de texto sin el binario
      const ghost = {
        id: msg.id + "_ghost",
        nick: msg.nick,
        time: msg.time,
        text: "envió una lata de atún.",
        replyTo: null,
        isPhotoGhost: true
      };
      rooms[room].history.push(ghost);
      while (rooms[room].history.length > MAX_HISTORY) rooms[room].history.shift();
    }
    io.to(room).emit("photo", msg);
  });

  // ---------- SD DESTROY ----------
  socket.on("sd-destroy", (data) => {
    socket.to(data.room).emit("sd-destroy", { msgId: data.msgId });
  });

  // ---------- BORRAR CHAT ----------
  socket.on("delete-chat", (data) => {
    const { room, code } = data;
    if (code !== DELETE_CODE) return;
    if (rooms[room]) {
      rooms[room].history = [];
      saveRooms(rooms);
      io.to(room).emit("chat-deleted");
    }
  });

  // ---------- PING ----------
  socket.on("ping-check", () => {
    socket.emit("pong-check", { nick: socket.nick, room: socket.room });
  });

  // ---------- TYPING ----------
  socket.on("typing", (data) => {
    socket.to(data.room).emit("typing", { nick: data.nick });
  });

  socket.on("stop-typing", (data) => {
    socket.to(data.room).emit("stop-typing", { nick: data.nick });
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    const { room, nick } = socket;
    rateLimitMap.delete(socket.id);
    if (!room || !rooms[room]) return;
    delete rooms[room].users[socket.id];
    socket.to(room).emit("user-left", nick);
    io.to(room).emit("update-users", Object.values(rooms[room].users));
  });

});

server.listen(process.env.PORT || 8080, () => {
  console.log("Server running on port", process.env.PORT || 8080);
});
