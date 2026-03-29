import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

export let io: SocketIOServer;

export function initSocket(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

    socket.on("join_room", (room: string) => {
      socket.join(room);
      console.log(`   ↳ ${socket.id} joined room: ${room}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌  Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
