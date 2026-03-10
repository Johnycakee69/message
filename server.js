const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Track connected users
const users = {}; // socketId -> username

// Track reactions: { msgId: { emoji: count } }
const reactions = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // User joins with a username
  socket.on('join', (username) => {
    users[socket.id] = username;
    console.log(`${username} joined`);

    // Tell everyone who is online
    io.emit('user_list', Object.values(users));

    // Notify others
    socket.broadcast.emit('system_message', `${username} joined the chat`);
  });

  // Handle incoming messages
  socket.on('send_message', (data) => {
    const username = users[socket.id] || 'Anonymous';
    const message = {
      username,
      text: data.text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' }),
      id: Date.now()
    };
    // Broadcast to everyone (including sender)
    io.emit('receive_message', message);
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const username = users[socket.id];
    socket.broadcast.emit('user_typing', { username, isTyping });
  });

  // Handle reactions
  socket.on('react_message', ({ msgId, emoji }) => {
    if (!reactions[msgId]) reactions[msgId] = {};
    reactions[msgId][emoji] = (reactions[msgId][emoji] || 0) + 1;
    io.emit('reaction_update', { msgId, reactions: reactions[msgId] });
  });

  socket.on('unreact_message', ({ msgId, emoji }) => {
    if (reactions[msgId] && reactions[msgId][emoji]) {
      reactions[msgId][emoji] = Math.max(0, reactions[msgId][emoji] - 1);
      io.emit('reaction_update', { msgId, reactions: reactions[msgId] });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      io.emit('user_list', Object.values(users));
      io.emit('system_message', `${username} left the chat`);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Messenger running at http://localhost:${PORT}`);
});
