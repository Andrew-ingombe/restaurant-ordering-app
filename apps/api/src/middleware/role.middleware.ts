import { NextFunction, Response } from "express"

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

export const requireRole = (...roles: string[]) => {
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
