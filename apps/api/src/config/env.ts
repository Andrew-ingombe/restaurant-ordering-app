import "dotenv/config"

const getRequiredEnvironmentVariable = (name: string) => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export const env = {
  mongodbUri: getRequiredEnvironmentVariable("MONGODB_URI"),
  port: Number(process.env.PORT) || 4000,
}
