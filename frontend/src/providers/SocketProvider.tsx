"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token) return;

    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001",
      {
        autoConnect: true,
        auth: { token },
        transports: ["websocket", "polling"],
      }
    );

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("🔌 Socket connected:", socketInstance.id);

      // Join role-based room so backend can broadcast targeted events
      if (user) {
        socketInstance.emit("join_room", user.role);
        socketInstance.emit("join_room", user.id);
      }
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Socket disconnected");
    });

    socketInstance.on("connect_error", (err) => {
      // Silently fail — backend may not be running yet
      console.warn("Socket connection failed:", err.message);
    });

    // ─── Real-time Event Handlers ────────────────────────────────────────

    socketInstance.on("expense_submitted", (data: { employee: string; description: string; amount: number }) => {
      toast("📋 New Expense Submitted", {
        description: `${data.employee} submitted "${data.description}" for $${data.amount?.toFixed(2)}`,
      });
    });

    socketInstance.on("expense_approved", (data: { description: string; approver?: string; overriddenBy?: string }) => {
      toast.success("✅ Expense Approved!", {
        description: `"${data.description}" was approved${data.approver ? ` by ${data.approver}` : ""}.`,
      });
    });

    socketInstance.on("expense_rejected", (data: { description: string; rejectionReason?: string; rejectedBy?: string }) => {
      toast.error("❌ Expense Rejected", {
        description: `"${data.description}" was rejected: ${data.rejectionReason || "No reason given"}.`,
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
