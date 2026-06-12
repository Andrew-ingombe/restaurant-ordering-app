import bcrypt from "bcryptjs"
import { Router } from "express"
import jwt, { SignOptions } from "jsonwebtoken"
import { z } from "zod"

import { env } from "../config/env"
import {
  authenticate,
  AuthenticatedRequest,
} from "../middleware/auth.middleware"
import { User } from "../models/user.model"

export const authRouter = Router()

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8),
})

authRouter.post("/login", async (request, response) => {
  const result = loginSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({
      message: "Invalid login details",
      errors: result.error.flatten().fieldErrors,
    })
    return
  }

  const user = await User.findOne({
    email: result.data.email,
    active: true,
  }).select("+passwordHash")

  if (!user) {
    response.status(401).json({ message: "Invalid email or password" })
    return
  }

  const passwordMatches = await bcrypt.compare(
    result.data.password,
    user.passwordHash
  )

  if (!passwordMatches) {
    response.status(401).json({ message: "Invalid email or password" })
    return
  }

  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    env.jwtSecret,
    options
  )

  response.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  })
})

authRouter.get(
  "/me",
  authenticate,
  async (request: AuthenticatedRequest, response) => {
    const user = await User.findById(request.user?.id)

    if (!user || !user.active) {
      response.status(404).json({ message: "User not found" })
      return
    }

    response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    })
  }
)
