const express = require("express")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)

const io = new Server(server,{
  cors:{
    origin:"*"
  }
})

app.use(express.static("public"))

let rooms={}

io.on("connection",(socket)=>{

  socket.on("join-room",(room)=>{

    socket.join(room)

    if(!rooms[room]) rooms[room]=[]

    rooms[room].push(socket.id)

  })

  socket.on("message",(data)=>{

    io.to(data.room).emit("message",data)

  })

  socket.on("delete-chat",(data)=>{

    io.to(data.room).emit("clear")

  })

})

server.listen(3000,()=>{
  console.log("server running")
})