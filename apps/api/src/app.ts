import cors from "cors"
import express from "express"
import mongoose from "mongoose"
import { authRouter } from "./routes/auth.routes"
import { userRouter } from "./routes/user.routes"
import { NextFunction, Request, Response } from "express"
import { menuRouter } from "./routes/menu.routes"
import { orderRouter } from "./routes/order.routes"
import { paymentRouter } from "./routes/payment.routes"

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
  app.use("/users", userRouter)
  app.use("/menu", menuRouter)
  app.use("/orders", orderRouter)
  app.use("/payments", paymentRouter)

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction
    ) => {
      console.error(error)

      response.status(500).json({
        message: "Internal server error",
      })
    }
  )

  return app
}
