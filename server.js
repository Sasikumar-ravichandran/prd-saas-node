require('dotenv').config(); // Load env variables
const app = require('./src/app');
const connectDB = require('./src/config/db');
const http = require('http');
const { Server } = require('socket.io');

// 1. Connect to Database
connectDB();

// 2. Create the HTTP Server using your Express app
const server = http.createServer(app);

// 3. Initialize Socket.io
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:5173",
      "http://localhost:5713", 
      "https://klinichub.com",
      "https://saas-server-3v56.onrender.com" // If needed, or your exact Vercel frontend URL
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Keep a global array of who is currently connected
let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  socket.on("setup", (userData) => {
    socket.join(userData._id);

    //  ONLINE STATUS LOGIC
    if (!onlineUsers.includes(userData._id)) {
      onlineUsers.push(userData._id);
    }
    io.emit("online users", onlineUsers); // Broadcast to everyone

    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
  });

  //  READ RECEIPTS LOGIC (Blue Ticks)
  socket.on("mark as read", async ({ chatId, userId }) => {
    try {
      // 1. Update the database to add this user to the readBy array
      const Message = require('./src/models/Message'); // Update path to your model
      await Message.updateMany(
        { chatId: chatId, readBy: { $ne: userId } },
        { $push: { readBy: userId } }
      );

      // 2. Tell everyone in this chat that messages were read!
      socket.to(chatId).emit("messages read", chatId);
    } catch (err) {
      console.log("Error marking as read", err);
    }
  });

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chatId;
    if (!chat.participants) return;

    chat.participants.forEach((user) => {
      if (user._id === newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });
  });

  socket.on("disconnect", () => {
    // Note: To properly track disconnects, you usually map socket.id to user._id.
    // For now, this is a basic disconnect tracker.
    console.log("USER DISCONNECTED");
  });
});

// 5. Start Server ( IMPORTANT: using server.listen instead of app.listen)
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});