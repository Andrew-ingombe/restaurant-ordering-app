import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { env } from "../config/env"
import { User, type UserRole } from "../models/user.model"

export type AuthenticatedUser = {
  id: string
  role: UserRole
  restaurantId?: string
  mustChangePassword: boolean
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser
}

type TokenPayload = {
  id?: unknown
}

export const authenticate = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({
      message: "Authentication required",
    })
    return
  }

  let payload: TokenPayload

  try {
    const token = authorization.slice(7)
    payload = jwt.verify(token, env.jwtSecret) as TokenPayload
  } catch {
    response.status(401).json({
      message: "Invalid or expired token",
    })
    return
  }

  if (typeof payload.id !== "string") {
    response.status(401).json({
      message: "Invalid or expired token",
    })
    return
  }

  try {
    const user = await User.findById(payload.id).select(
      "role restaurant active mustChangePassword"
    )

    if (!user || !user.active) {
      response.status(401).json({
        message: "Your account is unavailable or has been deactivated",
      })
      return
    }

    const restaurantId = user.restaurant?.toString()

    if (user.role !== "platform_admin" && !restaurantId) {
      response.status(403).json({
        message: "Restaurant access is unavailable",
      })
      return
    }

    const passwordChangeRoute =
      request.baseUrl === "/auth" &&
      (request.path === "/me" || request.path === "/password")

    if (user.mustChangePassword && !passwordChangeRoute) {
      response.status(403).json({
        message: "You must change your password before continuing",
        code: "PASSWORD_CHANGE_REQUIRED",
      })
      return
    }

    request.user = {
      id: user.id,
      role: user.role,
      restaurantId,
      mustChangePassword: user.mustChangePassword,
    }

    next()
  } catch (error) {
    next(error)
  }
}
