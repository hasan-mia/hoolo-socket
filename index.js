require("dotenv").config();
const http = require("http");
const express = require("express");
const app = express();
const cors = require("cors");
const socketIO = require("socket.io");

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// create server
const server = http.createServer(app);

// Port
const port = process.env.PORT || 5000;

// ===================================//
//      setup socket IO Server        //
//====================================//
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ==========user controls function==========
let onlineUsers = [];
// add user
const addNewUser = (useruuid, userName, socketId) => {
  const existingUser = onlineUsers?.find((user) => user?.useruuid === useruuid);
  if (!existingUser) {
    onlineUsers.push({ useruuid, userName, socketId });
  }
};
// remove user
const removeUser = (socketId) => {
  onlineUsers = onlineUsers?.filter((user) => user?.socketId !== socketId);
};
// get user by email
const getUser = (useruuid) => {
  return onlineUsers?.find((user) => user?.useruuid === useruuid);
};

// ======connect from socket-client=========

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("newUser", ({ useruuid, userName }) => {
    addNewUser(useruuid, userName, socket.id);
  });

  // ====live notification =====
  socket.on(
    "sendNotification",
    ({
      uuid,
      senderUuid,
      senderName,
      receiverUuid,
      receiverName,
      notification,
    }) => {
      const receiver = getUser(receiverUuid);
      // send data to client
      io.to(receiver?.socketId).emit({
        uuid,
        senderUuid,
        senderName,
        notification,
        receiverName,
      });
    }
  );

  // ====live feed comment of a post=====
  socket.on(
    "sendComment",
    ({ uuid, feeduuid, useruuid, commenterName, comment }) => {
      io.emit("getComment", {
        uuid,
        useruuid,
        feeduuid,
        commenterName,
        comment,
      });
    }
  );

  // ======disconnect from socket=========
  socket.on("disconnect", () => {
    console.log("A user disconnected");
    removeUser(socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
