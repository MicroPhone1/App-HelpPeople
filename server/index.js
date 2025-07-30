/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// ---- CONFIG ----
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGINS = [
  "http://localhost:3000",
  "http://192.168.1.158:3000", // local dev
  // "https://yourdomain.com",
];

// ---- MIDDLEWARE ----
app.use(cors({
  origin: (origin, callback) => {
    // Allow Postman/no origin + local dev + production
    if (!origin || CLIENT_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS Not Allowed'), false);
  },
}));
app.use(express.json());
app.disable('x-powered-by');

// ---- HEALTH CHECK ----
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Socket.IO Alert Server is running' });
});
app.get('/ping', (_req, res) => res.status(200).send('pong'));

// ---- IN-MEMORY LOG ----
/** @type {{ message: string, keyword: string, time: string, transcript?: string, receivedAt: string, from: string }[]} */
const alertLogs = [];
const MAX_LOGS = 100;

// ---- SOCKET.IO ----
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST'] },
  pingInterval: 25000, // (default 25000) for production LB
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] connected: ${socket.id}`);

  // Optional: Notify newly connected client about past alerts (latest 10)
  socket.emit('init', alertLogs.slice(0, 10));

  socket.on('alert', (data) => {
    if (typeof data !== 'object' || !data.message || !data.keyword || !data.time) {
      console.error('Invalid alert data received:', data);
      socket.emit('error', { error: 'Invalid alert data' });
      return;
    }

    const alertData = {
      ...data,
      receivedAt: new Date().toISOString(),
      from: socket.id,
    };
    alertLogs.unshift(alertData);
    if (alertLogs.length > MAX_LOGS) alertLogs.length = MAX_LOGS;

    console.log(
      `\x1b[32m[แจ้งเตือน]\x1b[0m ${alertData.message} (${alertData.keyword || '-'}) เวลา: ${alertData.time} (Received: ${alertData.receivedAt})`
    );

    // emit to all including sender
    io.emit('alert', alertData);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] disconnected: ${socket.id} (${reason})`);
  });

  // Optional: basic heartbeat
  socket.on('ping', () => socket.emit('pong'));
});

// ---- API: ดู log แจ้งเตือนล่าสุด ----
app.get('/logs', (_req, res) => {
  res.json({
    count: alertLogs.length,
    logs: alertLogs.slice(0, 50),
  });
});

// ---- API: เคลียร์ log (DEV ONLY, production ควรยืนยัน password/secret) ----
if (process.env.NODE_ENV !== "production") {
  app.delete('/logs', (_req, res) => {
    alertLogs.length = 0;
    res.json({ ok: true });
  });
}

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', url: req.originalUrl });
});

// ---- ERROR handler ----
app.use((err, _req, res) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || 'Server error' });
});

// ---- START SERVER ----
server.listen(PORT, () => {
  console.log(`\nSocket.IO listening on port ${PORT}`);
  console.log(`- Health check: http://localhost:${PORT}/`);
  console.log(`- Alert logs:   http://localhost:${PORT}/logs\n`);
});
