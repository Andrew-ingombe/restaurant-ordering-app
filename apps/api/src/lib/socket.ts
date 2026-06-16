import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import type { Server as HttpServer } from "http"

import { env } from "../config/env"
import type { UserRole } from "../models/user.model"

type SocketUser = {
  id: string
  role: UserRole
  restaurantId?: string
}

let io: Server | null = null

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.frontendUrls,
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

    if (user.restaurantId && user.role !== "platform_admin") {
      socket.join(`restaurant:${user.restaurantId}`)
      socket.join(`restaurant:${user.restaurantId}:role:${user.role}`)
      socket.join(`restaurant:${user.restaurantId}:user:${user.id}`)
    }
  })

  return io
}

export const getSocketServer = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized")
  }

  return io
}
