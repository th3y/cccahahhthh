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

socket.on("join-room",(room)=>{

socket.join(room)
socket.room = room

if(!rooms[room]){
rooms[room] = {
history:[],
users:[]
}
}

rooms[room].users.push(socket.id)

/* enviar historial */

socket.emit("history",rooms[room].history)

})

socket.on("message",(data)=>{

const room = data.room
if(!rooms[room]) return

const msg = {
nick:data.nick,
text:data.text,
time:data.time
}

rooms[room].history.push(msg)

/* limite historial */

if(rooms[room].history.length > 50){
rooms[room].history.shift()
}

io.to(room).emit("message",msg)

})

socket.on("delete-chat",(data)=>{

const room=data.room
const code=data.code

if(code !== "delete123") return

if(rooms[room]){
rooms[room].history=[]
}

io.to(room).emit("chat-deleted")

})

socket.on("disconnect",()=>{

const room = socket.room
if(!room || !rooms[room]) return

rooms[room].users = rooms[room].users.filter(u=>u!==socket.id)

})

})

server.listen(3000,()=>{
console.log("server running")
})