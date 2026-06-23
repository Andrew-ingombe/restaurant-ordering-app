import { model, Schema } from "mongoose"

export type UserRole = "platform_admin" | "owner" | "waiter" | "kitchen"

const userSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["platform_admin", "owner", "waiter", "kitchen"],
      required: true,
    },
    sharedHub: {
      type: Boolean,
      default: false,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

userSchema.index({ restaurant: 1, role: 1 })
userSchema.index({ restaurant: 1, role: 1, sharedHub: 1 })

export const User = model("User", userSchema)
