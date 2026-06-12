export const API_URL = import.meta.env.VITE_API_URL

export type UserRole = "owner" | "waiter" | "kitchen"

export type AuthUser = {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
}

export type LoginResponse = {
  token: string
  user: AuthUser
}

export const login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Login failed")
  }

  return data
}
