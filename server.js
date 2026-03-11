const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)

const io = new Server(server,{
cors:{ origin:"*" }
})

app.use(express.static("public"))

let rooms = {}

/*
rooms = {

  hash_room:{
     users:[
        {id:socketid}
     ],
     history:[
        {nick:"juan",text:"hola",time:"..."}
     ]
  }

}
*/

io.on("connection",(socket)=>{

/* JOIN ROOM */

socket.on("join-room",(roomHash)=>{

if(!rooms[roomHash]){

rooms[roomHash]={
users:[],
history:[]
}

}

let users = rooms[roomHash].users

/* limitar a 2 usuarios */


users.push({
id:socket.id
})

socket.join(roomHash)

/* enviar historial */

socket.emit("history",rooms[roomHash].history)

})

/* MENSAJE */

socket.on("message",(data)=>{

let room = data.room

if(!rooms[room]) return

rooms[room].history.push({
nick:data.nick,
text:data.text,
time:data.time
})

/* limitar historial tamaño */

if(rooms[room].history.length > 100){
rooms[room].history.shift()
}

io.to(room).emit("message",data)

})

/* BORRAR CHAT */

socket.on("delete-chat",(data)=>{

let room = data.room

if(!rooms[room]) return

rooms[room].history = []

io.to(room).emit("clear")

})

/* DISCONNECT */

socket.on("disconnect",()=>{

for(const room in rooms){

rooms[room].users =
rooms[room].users.filter(u=>u.id !== socket.id)

if(rooms[room].users.length === 0){
delete rooms[room]
}

}

})

})

/* LIMPIAR MENSAJES > 48 HORAS */

setInterval(()=>{

const now = Date.now()
const limit = 1000 * 60 * 60 * 48

for(const room in rooms){

rooms[room].history = rooms[room].history.filter(msg=>{

const msgTime = new Date(msg.time).getTime()

return (now - msgTime) < limit

})

}

}, 60 * 60 * 1000) // cada 1 hora

server.listen(3000,()=>{
console.log("server running")
})