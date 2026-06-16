import crypto from "crypto"

import { env } from "../config/env"

const getKey = () => {
  const key = Buffer.from(env.paymentCredentialsEncryptionKey, "hex")

  if (key.length !== 32) {
    throw new Error(
      "PAYMENT_CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters"
    )
  }

  return key
}

export const encryptSecret = (value: string) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export const decryptSecret = (value: string) => {
  const [ivValue, authTagValue, encryptedValue] = value.split(":")

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Encrypted secret is malformed")
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivValue, "base64")
  )

  decipher.setAuthTag(Buffer.from(authTagValue, "base64"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}
