import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { env } from "../config/env"
import type { UserRole } from "../models/user.model"

export type AuthenticatedUser = {
  id: string
  role: UserRole
  restaurantId?: string
}

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser
}

export const authenticate = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({ message: "Authentication required" })
    return
  }

  try {
    const token = authorization.slice(7)
    const payload = jwt.verify(token, env.jwtSecret) as AuthenticatedUser

    request.user = {
      id: payload.id,
      role: payload.role,
      restaurantId: payload.restaurantId,
    }

    next()
  } catch {
    response.status(401).json({
      message: "Invalid or expired token",
    })
  }
}
