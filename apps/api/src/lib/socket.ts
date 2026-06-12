import { Server } from "socket.io"
import jwt from "jsonwebtoken"
import type { Server as HttpServer } from "http"

import { env } from "../config/env"

type SocketUser = {
  id: string
  role: "owner" | "waiter" | "kitchen"
}

let io: Server | null = null

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.frontendUrl,
      methods: ["GET", "POST"],
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token

    if (!token) {
      next(new Error("Authentication required"))
      return
    }

    try {
      const user = jwt.verify(token, env.jwtSecret) as SocketUser

      socket.data.user = user
      next()
    } catch {
      next(new Error("Invalid or expired token"))
    }
  })

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser

    socket.join(`user:${user.id}`)
    socket.join(`role:${user.role}`)
  })

  return io
}

export const getSocketServer = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized")
  }

  return io
}
