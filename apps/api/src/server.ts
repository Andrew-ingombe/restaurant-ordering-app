import { createServer } from "http"

import { createApp } from "./app"
import { connectDatabase } from "./config/database"
import { env } from "./config/env"
import { initializeSocket } from "./lib/socket"

const startServer = async () => {
  try {
    await connectDatabase()

    const app = createApp()
    const server = createServer(app)

    initializeSocket(server)

    server.listen(env.port, () => {
      console.log(`API running on port ${env.port}`)
    })
  } catch (error) {
    console.error("Failed to start API:", error)
    process.exit(1)
  }
}

void startServer()
