import cors from "cors"
import express from "express"

export const createApp = () => {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "restaurant-ordering-api",
    })
  })

  return app
}
