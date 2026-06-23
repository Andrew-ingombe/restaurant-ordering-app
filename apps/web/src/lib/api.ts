export const API_URL = import.meta.env.VITE_API_URL

const API_AVAILABILITY_EVENT = "api:availability"

const reportApiAvailability = (available: boolean, message = "") => {
  window.dispatchEvent(
    new CustomEvent(API_AVAILABILITY_EVENT, {
      detail: {
        available,
        message,
      },
    })
  )
}

const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const response = await fetch(input, init)

    if ([502, 503, 504].includes(response.status)) {
      reportApiAvailability(
        false,
        "The restaurant service is temporarily unavailable."
      )
    } else {
      reportApiAvailability(true)
    }

    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    const message = navigator.onLine
      ? "The restaurant service cannot be reached right now."
      : "You appear to be offline. Check your internet connection."

    reportApiAvailability(false, message)
    throw new Error(message, {
      cause: error,
    })
  }
}

export type UserRole = "platform_admin" | "owner" | "waiter" | "kitchen"
export type MenuPreparationArea = "kitchen" | "bar" | "none"

export type PaymentMethod =
  | ""
  | "cash"
  | "card_pos"
  | "manual_mobile_money"
  | "lenco"
export type ManualPaymentMethod = "cash" | "card_pos" | "manual_mobile_money"

export type AuthUser = {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  restaurantId?: string
  sharedHub?: boolean
  mustChangePassword?: boolean
}

export type LoginResponse = {
  token: string
  user: AuthUser
}

export const login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await apiFetch(`${API_URL}/auth/login`, {
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
  sharedHub?: boolean
  mustChangePassword?: boolean
}

export const resetStaffPassword = async (
  id: string,
  temporaryPassword: string
): Promise<StaffUser> => {
  const data = await authenticatedRequest(`/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ temporaryPassword }),
  })

  return data.user
}

const authenticatedRequest = async (
  path: string,
  options: RequestInit = {}
) => {
  const token = localStorage.getItem("auth_token")

  const response = await apiFetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({
    message: "Request failed",
  }))

  if (response.status === 401) {
    window.dispatchEvent(new Event("auth:unauthorized"))
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }

  return data
}

export const getStaff = async (): Promise<StaffUser[]> => {
  const data = await authenticatedRequest("/users")
  return data.users
}

export const getActiveWaiters = async (): Promise<StaffUser[]> => {
  const data = await authenticatedRequest("/orders/active-waiters")
  return data.waiters
}

export const createStaff = async (details: {
  name: string
  email: string
  phone?: string
  password: string
  role: StaffRole
  sharedHub?: boolean
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
  preparationArea: MenuPreparationArea
}

export const getManagedMenu = async (): Promise<{
  categories: MenuCategory[]
  items: MenuItem[]
}> => authenticatedRequest("/menu/manage")

export const createMenuCategory = async (details: {
  name: string
  description: string
  preparationArea: MenuPreparationArea
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
    preparationArea: MenuPreparationArea
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
  preparationArea?: MenuPreparationArea
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
  preparationArea?: MenuPreparationArea
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
  paymentMethod?: PaymentMethod
  paidAt?: string
  paymentRecordedBy?: string
  createdAt: string
  waiter?: {
    _id: string
    name: string
  }
  createdBy?: {
    _id: string
    name: string
  }
  entryMode?: "personal" | "shared_hub" | "customer_qr"
  source?: "waiter" | "customer_qr"
  restaurantTable?: string
}

export const getPublicMenu = async (): Promise<{
  categories: MenuCategory[]
  items: PublicMenuItem[]
}> => {
  return authenticatedRequest("/menu")
}

export const createDraftOrder = async (details: {
  waiterId?: string
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

export type WaiterOrderHistoryStatus = "all" | "completed" | "cancelled"

export type WaiterOrdersResponse = {
  orders: DraftOrder[]
  historyOrders: DraftOrder[]
  historyPagination: {
    page: number
    limit: number
    totalOrders: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  historyStatus: WaiterOrderHistoryStatus
}

export const getMyOrders = async (
  page = 1,
  historyStatus: WaiterOrderHistoryStatus = "all",
  limit = 9
): Promise<WaiterOrdersResponse> => {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    historyStatus,
  })

  return authenticatedRequest(`/orders/mine?${query.toString()}`)
}

export const getMyOrder = async (id: string): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${id}`)
  return data.order
}

export const submitWaiterOrder = async (
  orderId: string
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${orderId}/submit`, {
    method: "PATCH",
  })

  return data.order
}

export const recordWaiterPayment = async (
  orderId: string,
  paymentMethod: ManualPaymentMethod
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${orderId}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ paymentMethod }),
  })

  return data.order
}

export type CheckoutDetails = {
  reference: string
  amount: number
  currency: string
  email: string
  publicKey: string
  checkoutScriptUrl: string
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
  attention: {
    servedUnpaid: {
      count: number
      total: number
    }
    unclaimedQrRequests: {
      count: number
    }
    delayedKitchenOrders: {
      count: number
      thresholdMinutes: number
    }
    pendingPayments: {
      count: number
    }
    failedPayments: {
      count: number
    }
  }
  paymentBreakdown: {
    method: "cash" | "card_pos" | "manual_mobile_money" | "lenco" | "unrecorded"
    count: number
    total: number
  }[]
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

export type RestaurantTable = {
  id: string
  name: string
  active: boolean
  menuUrl: string
}

export const getTables = async (): Promise<RestaurantTable[]> => {
  const data = await authenticatedRequest("/tables")
  return data.tables
}

export const createTable = async (name: string): Promise<RestaurantTable> => {
  const data = await authenticatedRequest("/tables", {
    method: "POST",
    body: JSON.stringify({ name }),
  })

  return data.table
}

export const updateTable = async (
  id: string,
  details: Partial<{
    name: string
    active: boolean
  }>
): Promise<RestaurantTable> => {
  const data = await authenticatedRequest(`/tables/${id}`, {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.table
}

export type CustomerTableMenu = {
  restaurant: {
    id: string
    name: string
  }
  table: {
    id: string
    name: string
  }
  categories: MenuCategory[]
  items: PublicMenuItem[]
}

export type CustomerOrderResponse = {
  message: string
  order: {
    id: string
    orderNumber: string
    tableName: string
    total: number
    status: "awaiting_waiter"
  }
}

export const getCustomerTableMenu = async (
  token: string
): Promise<CustomerTableMenu> => {
  const response = await apiFetch(
    `${API_URL}/customer-menu/table/${encodeURIComponent(token)}`
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Could not load menu")
  }

  return data
}

export type AvailableRestaurantTable = {
  id: string
  name: string
}

export const getAvailableTables = async (): Promise<
  AvailableRestaurantTable[]
> => {
  const data = await authenticatedRequest("/tables/available")
  return data.tables
}

export const submitCustomerOrder = async (details: {
  token: string
  customer: {
    name: string
    phone: string
  }
  items: {
    menuItem: string
    quantity: number
    notes: string
  }[]
}): Promise<CustomerOrderResponse> => {
  const response = await apiFetch(`${API_URL}/customer-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(details),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Could not submit order")
  }

  return data
}

export const getCustomerOrderRequests = async (): Promise<DraftOrder[]> => {
  const data = await authenticatedRequest("/orders/customer-requests")

  return data.orders
}

export const claimCustomerOrderRequest = async (
  orderId: string,
  waiterId?: string
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(
    `/orders/customer-requests/${orderId}/claim`,
    {
      method: "PATCH",
      body: JSON.stringify(waiterId ? { waiterId } : {}),
    }
  )

  return data.order
}

export const updateDraftOrder = async (
  orderId: string,
  details: {
    waiterId?: string
    orderType: "dine_in" | "takeaway"
    tableName: string
    customer: {
      name: string
      phone: string
      email: string
    }
    items: {
      menuItem: string
      quantity: number
      notes: string
    }[]
  }
): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/drafts/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.order
}

export const cancelOrder = async (orderId: string): Promise<DraftOrder> => {
  const data = await authenticatedRequest(`/orders/${orderId}/cancel`, {
    method: "PATCH",
  })

  return data.order
}

export const getCurrentUser = async (): Promise<AuthUser> => {
  const data = await authenticatedRequest("/auth/me")
  return data.user
}

export const changePassword = async (details: {
  currentPassword: string
  newPassword: string
}): Promise<{ message: string }> => {
  return authenticatedRequest("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(details),
  })
}

export type OwnerOrderStatus =
  | "draft"
  | "awaiting_waiter"
  | "awaiting_payment"
  | "submitted"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled"

export type OwnerOrder = Omit<
  DraftOrder,
  "status" | "waiter" | "restaurantTable"
> & {
  status: OwnerOrderStatus
  waiter?: {
    _id: string
    name: string
    email?: string
  } | null
  restaurantTable?:
    | {
        _id: string
        name: string
      }
    | string
    | null
  updatedAt?: string
}

export type OwnerOrderFilters = {
  search?: string
  status?: OwnerOrderStatus | "all"
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export type OwnerOrderHistory = {
  orders: OwnerOrder[]
  pagination: {
    page: number
    limit: number
    totalOrders: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  filters: {
    search: string
    status: OwnerOrderStatus | "all"
    dateFrom: string | null
    dateTo: string | null
  }
  timezone: string
}

export const getOwnerOrders = async (
  filters: OwnerOrderFilters = {}
): Promise<OwnerOrderHistory> => {
  const query = new URLSearchParams()

  if (filters.search) {
    query.set("search", filters.search)
  }

  if (filters.status && filters.status !== "all") {
    query.set("status", filters.status)
  }

  if (filters.dateFrom) {
    query.set("dateFrom", filters.dateFrom)
  }

  if (filters.dateTo) {
    query.set("dateTo", filters.dateTo)
  }

  if (filters.page) {
    query.set("page", filters.page.toString())
  }

  if (filters.limit) {
    query.set("limit", filters.limit.toString())
  }

  const queryString = query.toString()

  return authenticatedRequest(
    `/dashboard/orders${queryString ? `?${queryString}` : ""}`
  )
}

export const getOwnerOrder = async (orderId: string): Promise<OwnerOrder> => {
  const data = await authenticatedRequest(`/dashboard/orders/${orderId}`)
  return data.order
}

export type PlatformRestaurant = {
  id: string
  name: string
  slug: string
  active: boolean
  settings: {
    currency: string
    timezone: string
    phone: string
    email: string
    address: string
    receiptFooter: string
  }
  subscription: {
    plan: "pilot" | "starter" | "growth"
    status: "trialing" | "active" | "past_due" | "suspended" | "cancelled"
    trialEndsAt?: string
    currentPeriodStartsAt?: string
    currentPeriodEndsAt?: string
    gracePeriodEndsAt?: string
  }
  paymentSettings: {
    provider: "lenco"
    environment: "sandbox" | "production"
    baseUrl: string
    checkoutScriptUrl: string
    enabled: boolean
    publicKeyConfigured: boolean
    secretKeyConfigured: boolean
  }
  createdAt: string
}

export const getPlatformRestaurants = async (): Promise<
  PlatformRestaurant[]
> => {
  const data = await authenticatedRequest("/platform/restaurants")
  return data.restaurants
}

export const createPlatformRestaurant = async (details: {
  restaurant: {
    name: string
    currency: string
    timezone: string
    phone: string
    email: string
    address: string
    receiptFooter: string
  }
  owner: {
    name: string
    email: string
    phone: string
    password: string
  }
  subscription: {
    plan: "pilot" | "starter" | "growth"
    trialDays: number
  }
}): Promise<{
  restaurant: PlatformRestaurant
  owner: AuthUser
}> => {
  const data = await authenticatedRequest("/platform/restaurants", {
    method: "POST",
    body: JSON.stringify(details),
  })

  return {
    restaurant: data.restaurant,
    owner: data.owner,
  }
}

export const updateRestaurantPaymentSettings = async (
  restaurantId: string,
  details: {
    environment?: "sandbox" | "production"
    publicKey?: string
    secretKey?: string
    enabled?: boolean
  }
): Promise<PlatformRestaurant["paymentSettings"]> => {
  const data = await authenticatedRequest(
    `/platform/restaurants/${restaurantId}/payment-settings`,
    {
      method: "PATCH",
      body: JSON.stringify(details),
    }
  )

  return data.paymentSettings
}

export const updateRestaurantSubscription = async (
  restaurantId: string,
  details: Partial<{
    plan: "pilot" | "starter" | "growth"
    status: "trialing" | "active" | "past_due" | "suspended" | "cancelled"
    trialEndsAt: string
    currentPeriodStartsAt: string
    currentPeriodEndsAt: string
    gracePeriodEndsAt: string
  }>
): Promise<PlatformRestaurant["subscription"]> => {
  const data = await authenticatedRequest(
    `/platform/restaurants/${restaurantId}/subscription`,
    {
      method: "PATCH",
      body: JSON.stringify(details),
    }
  )

  return data.subscription
}

export type OwnerRestaurantSettings = {
  id: string
  name: string
  slug: string
  active: boolean
  settings: {
    currency: string
    timezone: string
    phone: string
    email: string
    address: string
    receiptFooter: string
  }
}

export const getRestaurantSettings =
  async (): Promise<OwnerRestaurantSettings> => {
    const data = await authenticatedRequest("/settings/restaurant")
    return data.restaurant
  }

export const updateRestaurantSettings = async (
  details: Partial<{
    name: string
    currency: string
    timezone: string
    phone: string
    email: string
    address: string
    receiptFooter: string
  }>
): Promise<OwnerRestaurantSettings> => {
  const data = await authenticatedRequest("/settings/restaurant", {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.restaurant
}

export type CloudinaryUploadSignature = {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

export const getMenuItemUploadSignature =
  async (): Promise<CloudinaryUploadSignature> => {
    return authenticatedRequest("/menu/uploads/signature", {
      method: "POST",
    })
  }

export const uploadMenuItemImage = async (
  file: File
): Promise<{
  secureUrl: string
}> => {
  const signature = await getMenuItemUploadSignature()
  const formData = new FormData()

  formData.append("file", file)
  formData.append("api_key", signature.apiKey)
  formData.append("timestamp", String(signature.timestamp))
  formData.append("folder", signature.folder)
  formData.append("signature", signature.signature)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message || "Image upload failed")
  }

  return {
    secureUrl: data.secure_url,
  }
}

export const updateStaff = async (
  id: string,
  details: Partial<{
    name: string
    email: string
    phone: string
    role: StaffRole
    sharedHub: boolean
  }>
): Promise<StaffUser> => {
  const data = await authenticatedRequest(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(details),
  })

  return data.user
}

export type RestaurantPaymentOptions = {
  manualMethods: ManualPaymentMethod[]
  lenco: {
    enabled: boolean
    environment: "sandbox" | "production"
  }
}

export const getRestaurantPaymentOptions =
  async (): Promise<RestaurantPaymentOptions> => {
    const data = await authenticatedRequest("/payments/options")
    return data.paymentOptions
  }

export const resetRestaurantOwnerPassword = async (
  restaurantId: string,
  temporaryPassword: string
): Promise<AuthUser> => {
  const data = await authenticatedRequest(
    `/platform/restaurants/${restaurantId}/owner-password`,
    {
      method: "PATCH",
      body: JSON.stringify({ temporaryPassword }),
    }
  )

  return data.owner
}
