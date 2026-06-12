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
