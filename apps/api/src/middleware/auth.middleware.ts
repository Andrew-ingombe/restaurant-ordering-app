import { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"

import { env } from "../config/env"

export type AuthenticatedRequest = Request & {
  user?: {
    id: string
    role: string
  }
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
    const payload = jwt.verify(token, env.jwtSecret) as {
      id: string
      role: string
    }

    request.user = payload
    next()
  } catch {
    response.status(401).json({ message: "Invalid or expired token" })
  }
}
