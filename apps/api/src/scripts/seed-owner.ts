import "dotenv/config"
import bcrypt from "bcryptjs"

import { connectDatabase } from "../config/database"
import { User } from "../models/user.model"

const seedOwner = async () => {
  const name = process.env.OWNER_NAME
  const email = process.env.OWNER_EMAIL?.toLowerCase()
  const password = process.env.OWNER_PASSWORD

  if (!name || !email || !password) {
    throw new Error("OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD are required")
  }

  if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters")
  }

  await connectDatabase()

  const passwordHash = await bcrypt.hash(password, 12)

  await User.findOneAndUpdate(
    { email },
    {
      name,
      email,
      passwordHash,
      role: "owner",
      active: true,
    },
    {
      upsert: true,
      new: true,
    }
  )

  console.log(`Owner account ready: ${email}`)
  process.exit(0)
}

seedOwner().catch((error) => {
  console.error(error)
  process.exit(1)
})
