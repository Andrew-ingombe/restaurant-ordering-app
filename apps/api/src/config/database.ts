import mongoose from "mongoose"

import { env } from "./env"

export const connectDatabase = async () => {
  await mongoose.connect(env.mongodbUri)

  console.log("MongoDB connected")
}
