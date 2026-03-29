import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { authRouter } from "./routes/auth";
import { expensesRouter } from "./routes/expenses";
import { usersRouter } from "./routes/users";
import { rulesRouter } from "./routes/rules";
import { errorHandler } from "./middleware/errorHandler";
import { initSocket } from "./lib/socket";

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO ─────────────────────────────────────────────────────────────
export const io = initSocket(httpServer);

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/users", usersRouter);
app.use("/api/rules", rulesRouter);

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "reimbursement-backend",
  });
});

// ─── Error Handler (must be last) ──────────────────────────────────────────
app.use(errorHandler);

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "5000", 10);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🗒️  Frontend expected at ${process.env.FRONTEND_URL}`);
  console.log(`\n📌 API Routes:`);
  console.log(`   POST  /api/auth/signup`);
  console.log(`   POST  /api/auth/login`);
  console.log(`   GET   /api/auth/me`);
  console.log(`   GET   /api/expenses`);
  console.log(`   POST  /api/expenses`);
  console.log(`   PATCH /api/expenses/:id/approve`);
  console.log(`   PATCH /api/expenses/:id/reject`);
  console.log(`   GET   /api/users`);
  console.log(`   POST  /api/users`);
  console.log(`   PUT   /api/users/:id`);
  console.log(`   GET   /api/rules`);
  console.log(`   POST  /api/rules`);
  console.log(`   PUT   /api/rules/:id`);
});
