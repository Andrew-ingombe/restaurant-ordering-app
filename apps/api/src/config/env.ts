import "dotenv/config"

const required = (name: string) => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
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
  restaurantTimezone: process.env.RESTAURANT_TIMEZONE || "Africa/Lusaka",
  tableTokenSecret: required("TABLE_TOKEN_SECRET"),
  defaultTrialDays: Number(process.env.DEFAULT_TRIAL_DAYS) || 30,
  paymentCredentialsEncryptionKey: required(
    "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
  ),
}
