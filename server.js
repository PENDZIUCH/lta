// server.js - Custom Next.js server con Socket.io
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // WebSocket signaling
  io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    // Join a broadcast room
    socket.on('join-broadcast', (broadcastId) => {
      socket.join(broadcastId);
      console.log(`📡 ${socket.id} joined broadcast: ${broadcastId}`);
    });

    // Forward signals to everyone in the room
    socket.on('signal', ({ broadcastId, signal }) => {
      console.log(`📨 Signal de ${socket.id} en ${broadcastId}:`, signal.type);
      socket.to(broadcastId).emit('signal', signal);
    });

    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`✅ Server running on http://${hostname}:${port}`);
  });
});
