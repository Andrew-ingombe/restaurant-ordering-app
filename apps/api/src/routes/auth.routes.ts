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
import { asyncHandler } from "../middleware/async-handler"

export const authRouter = Router()

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128),
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
      response.status(401).json({ message: "User not found" })
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

authRouter.patch(
  "/password",
  authenticate,
  asyncHandler(async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest
    const result = changePasswordSchema.safeParse(request.body)

    if (!result.success) {
      response.status(400).json({
        message: "Invalid password details",
        errors: result.error.flatten().fieldErrors,
      })
      return
    }

    if (result.data.currentPassword === result.data.newPassword) {
      response.status(400).json({
        message: "New password must be different",
      })
      return
    }

    const user = await User.findById(authenticatedRequest.user?.id).select(
      "+passwordHash"
    )

    if (!user || !user.active) {
      response.status(401).json({
        message: "Your account is unavailable",
      })
      return
    }

    const passwordMatches = await bcrypt.compare(
      result.data.currentPassword,
      user.passwordHash
    )

    if (!passwordMatches) {
      response.status(400).json({
        message: "Current password is incorrect",
      })
      return
    }

    user.passwordHash = await bcrypt.hash(result.data.newPassword, 12)

    await user.save()

    response.json({
      message: "Password changed successfully",
    })
  })
)
