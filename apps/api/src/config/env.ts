import "dotenv/config"

const required = (name: string) => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

const parseOrigins = (value?: string) => {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export const env = {
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  port: Number(process.env.PORT) || 4000,
  lencoSecretKey: required("LENCO_SECRET_KEY"),
  lencoBaseUrl:
    process.env.LENCO_BASE_URL || "https://sandbox.lenco.co/access/v2",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  frontendUrls: parseOrigins(process.env.FRONTEND_URLS) ||
    parseOrigins(process.env.FRONTEND_URL) || ["http://localhost:5173"],
  restaurantTimezone: process.env.RESTAURANT_TIMEZONE || "Africa/Lusaka",
  tableTokenSecret: required("TABLE_TOKEN_SECRET"),
  defaultTrialDays: Number(process.env.DEFAULT_TRIAL_DAYS) || 30,
  paymentCredentialsEncryptionKey: required(
    "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
  ),
  apiJsonLimit: process.env.API_JSON_LIMIT || "1mb",
  authRateWindowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000,
  authRateMax: Number(process.env.AUTH_RATE_MAX) || 20,
  publicRateWindowMs:
    Number(process.env.PUBLIC_RATE_WINDOW_MS) || 15 * 60 * 1000,
  publicRateMax: Number(process.env.PUBLIC_RATE_MAX) || 100,
  cloudinaryCloudName: required("CLOUDINARY_CLOUD_NAME"),
  cloudinaryApiKey: required("CLOUDINARY_API_KEY"),
  cloudinaryApiSecret: required("CLOUDINARY_API_SECRET"),
  cloudinaryUploadFolder:
    process.env.CLOUDINARY_UPLOAD_FOLDER || "restaurant-ordering/menu-items",
}
