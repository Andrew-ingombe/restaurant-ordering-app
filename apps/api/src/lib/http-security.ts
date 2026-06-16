import type { CorsOptions } from "cors"
import rateLimit from "express-rate-limit"
import helmet from "helmet"

import { env } from "../config/env"

const isAllowedOrigin = (origin?: string) => {
  if (!origin) {
    return true
  }

  return env.frontendUrls.includes(origin)
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error("Origin not allowed by CORS"))
  },
  credentials: true,
}

export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
})

export const authRateLimiter = rateLimit({
  windowMs: env.authRateWindowMs,
  max: env.authRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
})

export const publicRateLimiter = rateLimit({
  windowMs: env.publicRateWindowMs,
  max: env.publicRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
})
