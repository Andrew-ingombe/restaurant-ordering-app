import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export const getSocket = () => {
  const token = localStorage.getItem("auth_token")

  if (!token) {
    return null
  }

  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
    })
  }

  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}
