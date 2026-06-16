import { NextFunction, Response } from "express"

import type { UserRole } from "../models/user.model"
import { AuthenticatedRequest } from "./auth.middleware"

export const requireOwner = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  if (request.user?.role !== "owner") {
    response.status(403).json({
      message: "Owner access required",
    })
    return
  }

  next()
}

export const requirePlatformAdmin = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  if (request.user?.role !== "platform_admin") {
    response.status(403).json({
      message: "Platform administrator access required",
    })
    return
  }

  next()
}

export const requireRestaurantContext = (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) => {
  if (!request.user?.restaurantId || request.user.role === "platform_admin") {
    response.status(403).json({
      message: "Restaurant access is required",
    })
    return
  }

  next()
}

export const requireRole = (...roles: UserRole[]) => {
  return (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
  ) => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({
        message: "You do not have permission to perform this action",
      })
      return
    }

    next()
  }
}
