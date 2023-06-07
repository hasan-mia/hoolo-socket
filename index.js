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
// Object to store offline notifications
const offlineNotifications = {};
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
// get user by useruuid
const getUser = (useruuid) => {
  return onlineUsers?.find((user) => user?.useruuid === useruuid);
};

// ======connect from socket-client=========

io.on("connection", (socket) => {
  const socketId = socket.id;

  console.log(socketId + " is connected");

  socket.on("newUser", ({ userUuid, userName }) => {
    addNewUser(userUuid, userName, socketId);
    io.emit("socketUser", { userUuid, userName, socketId });
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
      // Check if the user is currently online
      if (io.sockets.connected[socketId]) {
        // User is online, emit the comment directly
        io.to(receiver?.socketId).emit("sendNotification", {
          uuid,
          senderUuid,
          senderName,
          notification,
          receiverName,
        });
      } else {
        // User is offline, save the notification for later
        if (!offlineNotifications[userId]) {
          offlineNotifications[userId] = [];
        }
        offlineNotifications[userId].push({
          uuid,
          senderUuid,
          senderName,
          notification,
          receiverName,
        });
      }
    }
  );

  // ====live feed comment of a post=====
  socket.on(
    "sendComment",
    ({ profilePic, feeduuid, userUuid, commenterName, commentData, time }) => {
      io.emit("getComment", {
        profilePic,
        userUuid,
        feeduuid,
        commenterName,
        commentData,
        time,
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
