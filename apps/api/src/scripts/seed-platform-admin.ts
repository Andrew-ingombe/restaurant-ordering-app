import "dotenv/config"
import bcrypt from "bcryptjs"

import { connectDatabase } from "../config/database"
import { User } from "../models/user.model"

const seedPlatformAdmin = async () => {
  const name = process.env.PLATFORM_ADMIN_NAME
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()
  const password = process.env.PLATFORM_ADMIN_PASSWORD

  if (!name || !email || !password) {
    throw new Error(
      "PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required"
    )
  }

  if (password.length < 8) {
    throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 8 characters")
  }

  await connectDatabase()

  const existingUser = await User.findOne({ email })

  if (existingUser) {
    if (existingUser.role !== "platform_admin") {
      throw new Error("This email already belongs to a non-platform-admin user")
    }

    existingUser.name = name
    existingUser.active = true
    existingUser.restaurant = undefined

    await existingUser.save()

    console.log(`Platform administrator already exists: ${email}`)
    process.exit(0)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await User.create({
    name,
    email,
    passwordHash,
    role: "platform_admin",
    active: true,
  })

  console.log(`Platform administrator created: ${email}`)
  process.exit(0)
}

seedPlatformAdmin().catch((error) => {
  console.error(error)
  process.exit(1)
})
