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
const port = process.env.PORT || 5001;

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

// one to one video calling room
const rooms = {};

// ===============================
//  Connect from socket-client  //
//================================

io.on("connection", (socket) => {
  const socketId = socket.id;

  console.log(socketId + " is connected");
  // =======================================
  //  Live notification for specific user //
  // =======================================

  socket.on("newUser", ({ userUuid, userName }) => {
    addNewUser(userUuid, userName, socketId);
    io.emit("socketUser", { userUuid, userName, socketId });
  });

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

  // =====================================
  //    Live feed comment of a post     //
  // =====================================

  socket.on(
    "sendComment",
    ({
      comment_uuid,
      parent_uuid,
      user_info,
      feed_uuid,
      user_uuid,
      name,
      comment,
      times,
      likes,
    }) => {
      io.emit("getComment", {
        comment_uuid,
        parent_uuid,
        user_info,
        feed_uuid,
        user_uuid,
        name,
        comment,
        times,
        likes,
      });
    }
  );

  // =====================================
  //       One to One Video Calling     //
  // =====================================
  socket.on("join-room", ({ roomID, userName, userImg }) => {
    // else create a new room
    if (rooms[roomID] === undefined) {
      rooms[roomID] = [{ id: socketId, userName, userImg }];
    }
    if (rooms[roomID] !== undefined) {
      const existingUser = rooms[roomID]?.find((user) => user.id === socketId);
      if (!existingUser) {
        rooms[roomID].push({ id: socketId, userName, userImg });
      }
    }

    // finding the user - see if id is of the user in room exist
    const user = rooms[roomID].find((user) => user.id !== socketId);
    if (user) {
      socket.emit("old-user", { userId: user.id, userName, userImg });
      // if someone new user has joined then we get the id of the other user
      socket
        .to(user.id)
        .emit("new-user", { newUserId: socketId, userName, userImg });
    }
  });

  // creating an offer and send the event to other user
  socket.on("offer", (payload) => {
    io.to(payload.target).emit("offer", payload);
  });

  // answering the call and sending it back to the original user
  socket.on("answer", (payload) => {
    io.to(payload.target).emit("answer", payload);
  });

  // finding the path with ice-candidate
  socket.on("ice-candidate", (incoming) => {
    io.to(incoming.target).emit("ice-candidate", incoming.candidate);
  });

  // =====================================
  //    Disconnected users controll     //
  // =====================================

  socket.on("disconnect", () => {
    console.log("A user disconnected");
    // remove user from notification room
    removeUser(socket.id);
    // remove user form room if disconnect
    for (const roomID in rooms) {
      const room = rooms[roomID];
      const index = room.findIndex((user) => user.id === socketId);
      if (index !== -1) {
        room.splice(index, 1);
        const otherUser = room[0];
        if (otherUser) {
          socket.to(otherUser.id).emit("user left");
        }
        break; // Assuming a user can only be in one room, exit the loop after finding the room.
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
