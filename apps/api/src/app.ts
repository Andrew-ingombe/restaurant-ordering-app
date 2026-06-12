import cors from "cors"
import express from "express"
import mongoose from "mongoose"
import { authRouter } from "./routes/auth.routes"

export const createApp = () => {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get("/health", (_request, response) => {
    const databaseConnected = mongoose.connection.readyState === 1

    response.status(databaseConnected ? 200 : 503).json({
      status: databaseConnected ? "ok" : "unavailable",
      service: "restaurant-ordering-api",
      database: databaseConnected ? "connected" : "disconnected",
    })
  })

  app.use("/auth", authRouter)

  return app
}
