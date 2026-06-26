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
import { Restaurant } from "../models/restaurant.model"

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

const blockedSubscriptionStatuses = ["suspended", "cancelled"]

const getRestaurantAccessStatus = async (restaurantId?: string) => {
  if (!restaurantId) {
    return {
      allowed: true,
    }
  }

  const restaurant = await Restaurant.findById(restaurantId).select(
    "active subscription.status"
  )

  if (!restaurant || !restaurant.active) {
    return {
      allowed: false,
      message: "Restaurant access is unavailable",
    }
  }

  const subscriptionStatus = restaurant.subscription?.status || "trialing"

  if (blockedSubscriptionStatuses.includes(subscriptionStatus)) {
    return {
      allowed: false,
      message: `Restaurant access is ${subscriptionStatus}`,
    }
  }

  return {
    allowed: true,
  }
}

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
    response.status(401).json({
      message: user.mustChangePassword
        ? "Your password was reset. Please enter your temporary password to continue."
        : "Invalid email or password",
    })
    return
  }

  if (!user.active) {
    response.status(403).json({
      message: "Your account is deactivated. Please contact your manager.",
    })
    return
  }

  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  }

  const restaurantId = user.restaurant?.toString()

  if (user.role !== "platform_admin") {
    const accessStatus = await getRestaurantAccessStatus(restaurantId)

    if (!accessStatus.allowed) {
      response.status(403).json({
        message: accessStatus.message,
      })
      return
    }
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      ...(restaurantId ? { restaurantId } : {}),
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
      restaurantId,
      sharedHub: Boolean(user.sharedHub),
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  })
})

authRouter.get(
  "/me",
  authenticate,
  async (request: AuthenticatedRequest, response) => {
    const user = await User.findById(request.user?.id)

    if (!user) {
      response.status(401).json({ message: "User not found" })
      return
    }

    if (!user.active) {
      response.status(403).json({
        message: "Your account is deactivated. Please contact your manager.",
      })
      return
    }

    const restaurantId = user.restaurant?.toString()

    if (user.role !== "platform_admin") {
      const accessStatus = await getRestaurantAccessStatus(restaurantId)

      if (!accessStatus.allowed) {
        response.status(403).json({
          message: accessStatus.message,
        })
        return
      }
    }

    response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        restaurantId,
        sharedHub: Boolean(user.sharedHub),
        mustChangePassword: Boolean(user.mustChangePassword),
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
        message: user.mustChangePassword
          ? "Enter your temporary password to create a new password."
          : "Current password is incorrect",
      })
      return
    }

    user.passwordHash = await bcrypt.hash(result.data.newPassword, 12)
    user.mustChangePassword = false

    await user.save()

    response.json({
      message: "Password changed successfully",
    })
  })
)
