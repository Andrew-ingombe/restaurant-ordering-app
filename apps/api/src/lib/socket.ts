import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import type { Server as HttpServer } from "http"

import { env } from "../config/env"
import { User, type UserRole } from "../models/user.model"

type SocketUser = {
  id: string
  role: UserRole
  restaurantId?: string
  mustChangePassword: boolean
}

type TokenPayload = {
  id?: unknown
}

let io: Server | null = null

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.frontendUrls,
      methods: ["GET", "POST"],
    },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token

    if (typeof token !== "string" || !token) {
      next(new Error("Authentication required"))
      return
    }

    let payload: TokenPayload

    try {
      payload = jwt.verify(token, env.jwtSecret) as TokenPayload
    } catch {
      next(new Error("Invalid or expired token"))
      return
    }

    if (typeof payload.id !== "string") {
      next(new Error("Invalid or expired token"))
      return
    }

    try {
      const user = await User.findById(payload.id).select(
        "role restaurant active mustChangePassword"
      )

      if (!user || !user.active) {
        next(new Error("Account unavailable"))
        return
      }

      if (user.mustChangePassword) {
        next(new Error("Password change required"))
        return
      }

      const restaurantId = user.restaurant?.toString()

      if (user.role !== "platform_admin" && !restaurantId) {
        next(new Error("Restaurant access unavailable"))
        return
      }

      const socketUser: SocketUser = {
        id: user.id,
        role: user.role,
        restaurantId,
        mustChangePassword: user.mustChangePassword,
      }

      socket.data.user = socketUser
      next()
    } catch {
      next(new Error("Could not authenticate socket connection"))
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

export const disconnectUserSockets = (userId: string) => {
  if (!io) {
    return
  }

  io.in(`user:${userId}`).disconnectSockets(true)
}

export const getSocketServer = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized")
  }

  return io
}
