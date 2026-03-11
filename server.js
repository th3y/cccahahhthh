const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)

const io = new Server(server,{
cors:{origin:"*"}
})

const rooms = {}

io.on("connection",(socket)=>{

socket.on("join-room",(data)=>{

const room=data.room
const nick=data.nick

socket.join(room)

socket.room=room
socket.nick=nick

if(!rooms[room]){

rooms[room]={
history:[],
users:{}
}

}

rooms[room].users[socket.id]=nick

/* enviar historial */

socket.emit("history",rooms[room].history)

/* avisar que alguien entró */

socket.to(room).emit("user-joined",nick)

})

/* MENSAJE */

socket.on("message",(data)=>{

const room=data.room
if(!rooms[room]) return

const msg={
nick:data.nick,
text:data.text,
time:data.time
}

rooms[room].history.push(msg)

/* limitar historial */

if(rooms[room].history.length>50){

rooms[room].history.shift()

}

io.to(room).emit("message",msg)

})

/* BORRAR CHAT */

socket.on("delete-chat",(data)=>{

const room=data.room
const code=data.code

if(code!=="delete123") return

if(rooms[room]){

rooms[room].history=[]

}

io.to(room).emit("chat-deleted")

})

/* DESCONECTAR */

socket.on("disconnect",()=>{

const room=socket.room
const nick=socket.nick

if(!room || !rooms[room]) return

delete rooms[room].users[socket.id]

socket.to(room).emit("user-left",nick)

})

})

server.listen(3000,()=>{

console.log("server running")

})