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

export type StaffRole = "waiter" | "kitchen"

export type StaffUser = {
  _id?: string
  id?: string
  name: string
  email: string
  phone?: string
  role: UserRole
  active: boolean
}

const authenticatedRequest = async (
  path: string,
  options: RequestInit = {}
) => {
  const token = localStorage.getItem("auth_token")

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }

  return data
}

export const getStaff = async (): Promise<StaffUser[]> => {
  const data = await authenticatedRequest("/users")
  return data.users
}

export const createStaff = async (details: {
  name: string
  email: string
  phone?: string
  password: string
  role: StaffRole
}): Promise<StaffUser> => {
  const data = await authenticatedRequest("/users", {
    method: "POST",
    body: JSON.stringify(details),
  })

  return data.user
}

export const updateStaffStatus = async (
  id: string,
  active: boolean
): Promise<StaffUser> => {
  const data = await authenticatedRequest(`/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  })

  return data.user
}
