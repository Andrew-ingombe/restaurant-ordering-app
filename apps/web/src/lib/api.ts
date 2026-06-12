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

export type MenuCategory = {
  _id: string
  name: string
  description: string
  active: boolean
  sortOrder: number
}

export const getManagedMenu = async (): Promise<{
  categories: MenuCategory[]
  items: MenuItem[]
}> => authenticatedRequest("/menu/manage")

export const createMenuCategory = async (details: {
  name: string
  description: string
}): Promise<MenuCategory> => {
  const data = await authenticatedRequest("/menu/categories", {
    method: "POST",
    body: JSON.stringify(details),
  })

  return data.category
}

export const updateMenuCategory = async (
  id: string,
  details: Partial<{
    name: string
    description: string
    active: boolean
    sortOrder: number
  }>
): Promise<MenuCategory> => {
  const data = await authenticatedRequest(`/menu/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.category
}

export type MenuItemCategory = {
  _id: string
  name: string
}

export type MenuItem = {
  _id: string
  category: MenuItemCategory
  name: string
  description: string
  price: number
  available: boolean
  imageUrl: string
  sortOrder: number
}

export const createMenuItem = async (details: {
  category: string
  name: string
  description: string
  price: number
  imageUrl?: string
}): Promise<MenuItem> => {
  const data = await authenticatedRequest("/menu/items", {
    method: "POST",
    body: JSON.stringify(details),
  })

  return data.item
}

export const updateMenuItem = async (
  id: string,
  details: Partial<{
    category: string
    name: string
    description: string
    price: number
    available: boolean
    imageUrl: string
  }>
): Promise<MenuItem> => {
  const data = await authenticatedRequest(`/menu/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.item
}

export type PublicMenuItem = {
  _id: string
  category: MenuItemCategory
  name: string
  description: string
  price: number
  imageUrl: string
}

export type OrderItem = {
  menuItem: string
  name: string
  unitPrice: number
  quantity: number
  notes: string
  lineTotal: number
}

export type DraftOrder = {
  _id: string
  orderNumber: string
  orderType: "dine_in" | "takeaway"
  tableName: string
  customer: {
    name: string
    phone: string
    email?: string
  }
  items: OrderItem[]
  subtotal: number
  total: number
  currency: string
  status: string
  paymentStatus: string
  createdAt: string
  waiter?: {
    _id: string
    name: string
  }
}

export const getPublicMenu = async (): Promise<{
  categories: MenuCategory[]
  items: PublicMenuItem[]
}> => {
  const response = await fetch(`${API_URL}/menu`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Could not load menu")
  }

  return data
}

export const createDraftOrder = async (details: {
  orderType: "dine_in" | "takeaway"
  tableName: string
  customer: {
    name: string
    phone: string
  }
  items: {
    menuItem: string
    quantity: number
    notes: string
  }[]
}): Promise<DraftOrder> => {
  const data = await authenticatedRequest("/orders/drafts", {
    method: "POST",
    body: JSON.stringify(details),
  })

  return data.order
}

export const getMyOrders = async (): Promise<DraftOrder[]> => {
  const data = await authenticatedRequest("/orders/mine")
  return data.orders
}

export const getMyOrder = async (id: string): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${id}`)
  return data.order
}

export type CheckoutDetails = {
  reference: string
  amount: number
  currency: string
  email: string
  customer: {
    firstName: string
    lastName: string
    phone: string
  }
}

export const initializePayment = async (
  orderId: string,
  customer: {
    name: string
    phone: string
    email: string
  }
): Promise<CheckoutDetails> => {
  const data = await authenticatedRequest(
    `/payments/orders/${orderId}/initialize`,
    {
      method: "POST",
      body: JSON.stringify({ customer }),
    }
  )

  return data.checkout
}

export const verifyPayment = async (
  orderId: string,
  reference: string
): Promise<DraftOrder> => {
  const data = await authenticatedRequest("/payments/verify", {
    method: "POST",
    body: JSON.stringify({ orderId, reference }),
  })

  return data.order
}

export type KitchenStatus = "submitted" | "accepted" | "preparing" | "ready"

export const getKitchenOrders = async (): Promise<DraftOrder[]> => {
  const data = await authenticatedRequest("/kitchen/orders")
  return data.orders
}

export const updateKitchenOrderStatus = async (
  orderId: string,
  status: Exclude<KitchenStatus, "submitted">
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/kitchen/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })

  return data.order
}

export const updateWaiterOrderStatus = async (
  orderId: string,
  status: "served" | "completed"
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })

  return data.order
}

export type DashboardSummary = {
  date: string
  timezone: string
  summary: {
    totalSales: number
    paidOrders: number
    completedOrders: number
    activeOrders: number
    averageOrderValue: number
  }
  statusBreakdown: {
    status: string
    count: number
  }[]
  bestSellingItems: {
    menuItem: string
    name: string
    quantity: number
    sales: number
  }[]
  recentOrders: DraftOrder[]
}

export const getDashboardSummary = async (
  date?: string
): Promise<DashboardSummary> => {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  return authenticatedRequest(`/dashboard/summary${query}`)
}
