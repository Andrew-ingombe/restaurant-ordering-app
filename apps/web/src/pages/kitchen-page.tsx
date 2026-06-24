import { useEffect, useMemo, useState, useRef } from "react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import {
  BellRing,
  Check,
  ChefHat,
  Clock3,
  CookingPot,
  KeyRound,
  LogOut,
  Menu,
  PackageCheck,
  RefreshCw,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import { getKitchenOrders, updateKitchenOrderStatus } from "../lib/api"
import type { AuthUser, DraftOrder, KitchenStatus } from "../lib/api"
import { getSocket } from "../lib/socket"

import { KitchenColumnsSkeleton } from "../components/page-skeletons"

type KitchenPageProps = {
  user: AuthUser
  onLogout: () => void
}

const columns: {
  status: KitchenStatus
  title: string
  description: string
  nextStatus?: Exclude<KitchenStatus, "submitted">
  action?: string
  icon: typeof BellRing
  accent: string
  badge: string
}[] = [
  {
    status: "submitted",
    title: "New",
    description: "Accept incoming orders",
    nextStatus: "accepted",
    action: "Accept order",
    icon: BellRing,
    accent: "bg-[#ef1428]",
    badge: "bg-red-50 text-red-700",
  },
  {
    status: "accepted",
    title: "Accepted",
    description: "Queued for prep",
    nextStatus: "preparing",
    action: "Start preparing",
    icon: Check,
    accent: "bg-neutral-950",
    badge: "bg-neutral-100 text-neutral-700",
  },
  {
    status: "preparing",
    title: "Preparing",
    description: "Being cooked now",
    nextStatus: "ready",
    action: "Mark ready",
    icon: CookingPot,
    accent: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
  },
  {
    status: "ready",
    title: "Ready",
    description: "Waiting for pickup",
    icon: PackageCheck,
    accent: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
]

const activeStatuses = ["submitted", "accepted", "preparing", "ready"]
const statusLabels: Record<string, string> = {
  submitted: "new",
  accepted: "accepted",
  preparing: "preparing",
  ready: "ready",
}

const getOrderAgeInMinutes = (createdAt: string) => {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )
}

const formatOrderAge = (minutes: number) => {
  if (minutes < 1) return "Just now"
  if (minutes === 1) return "1 min"
  if (minutes < 60) return `${minutes} mins`

  const hours = Math.floor(minutes / 60)

  return `${hours}h ${minutes % 60}m`
}

const getOrderAge = (createdAt: string) => {
  return formatOrderAge(getOrderAgeInMinutes(createdAt))
}

const getAgeStyle = (createdAt: string) => {
  const minutes = getOrderAgeInMinutes(createdAt)

  if (minutes >= 30) {
    return "bg-red-50 text-red-700"
  }

  if (minutes >= 15) {
    return "bg-amber-50 text-amber-700"
  }

  return "bg-neutral-100 text-neutral-600"
}

const shouldShowKitchenOrder = (order: DraftOrder) => {
  return activeStatuses.includes(order.status) && order.items.length > 0
}

function KitchenOrderCard({
  order,
  nextStatus,
  action,
  updating,
  onAdvance,
}: {
  order: DraftOrder
  nextStatus?: Exclude<KitchenStatus, "submitted">
  action?: string
  updating: boolean
  onAdvance: (
    orderId: string,
    status: Exclude<KitchenStatus, "submitted">
  ) => void
}) {
  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0
  )

  return (
    <article className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
              {order.tableName || "Takeaway"}
            </p>

            <h3 className="mt-1 text-lg font-black tracking-tight">
              {order.orderNumber}
            </h3>
          </div>

          <Badge
            className={`rounded-full border-0 ${getAgeStyle(order.createdAt)}`}
          >
            <Clock3 className="size-3" />
            {getOrderAge(order.createdAt)}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          <span>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>

          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" />
            {order.waiter?.name || "Unknown waiter"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {order.items.map((item, index) => (
            <div
              key={`${item.menuItem}-${index}`}
              className="rounded-xl border border-neutral-100 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-sm font-black text-white">
                  {item.quantity}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold">{item.name}</p>

                  {item.notes && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-5 font-medium text-amber-900">
                      <span className="mr-1 text-xs font-bold tracking-wide uppercase">
                        Note:
                      </span>
                      {item.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {nextStatus && action ? (
          <Button
            className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
            disabled={updating}
            onClick={() => onAdvance(order._id, nextStatus)}
          >
            {updating ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Updating...
              </>
            ) : (
              action
            )}
          </Button>
        ) : (
          <div className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">
            <Check className="size-4" />
            Ready for collection
          </div>
        )}
      </div>
    </article>
  )
}

export function KitchenPage({ user, onLogout }: KitchenPageProps) {
  const [orders, setOrders] = useState<DraftOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [, setClock] = useState(Date.now())
  const orderStatusesRef = useRef(new Map<string, string>())

  const navigate = useNavigate()

  const loadOrders = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      setError("")
      const kitchenOrders = (await getKitchenOrders()).filter(
        shouldShowKitchenOrder
      )

      setOrders(kitchenOrders)

      orderStatusesRef.current = new Map(
        kitchenOrders.map((order) => [order._id, order.status])
      )

      if (showRefreshing) {
        toast.success("Kitchen board refreshed")
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load kitchen orders"
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadOrders()

    const refreshTimer = window.setInterval(() => {
      void loadOrders()
    }, 30000)

    const clockTimer = window.setInterval(() => {
      setClock(Date.now())
    }, 60000)

    return () => {
      window.clearInterval(refreshTimer)
      window.clearInterval(clockTimer)
    }
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const upsertOrder = (
      updatedOrder: DraftOrder,
      announceNewOrder = false
    ) => {
      const previousStatus = orderStatusesRef.current.get(updatedOrder._id)
      const shouldShow = shouldShowKitchenOrder(updatedOrder)

      if (shouldShow) {
        orderStatusesRef.current.set(updatedOrder._id, updatedOrder.status)
      } else {
        orderStatusesRef.current.delete(updatedOrder._id)
      }

      setOrders((current) => {
        if (!shouldShow) {
          return current.filter((order) => order._id !== updatedOrder._id)
        }

        const exists = current.some((order) => order._id === updatedOrder._id)

        if (exists) {
          return current.map((order) =>
            order._id === updatedOrder._id ? updatedOrder : order
          )
        }

        return [...current, updatedOrder]
      })

      if (announceNewOrder && !previousStatus && shouldShow) {
        toast.info(`New kitchen order: ${updatedOrder.orderNumber}`, {
          description: updatedOrder.tableName || "Takeaway order",
        })
        return
      }

      if (
        previousStatus &&
        previousStatus !== updatedOrder.status &&
        shouldShow
      ) {
        toast.info(`${updatedOrder.orderNumber} updated`, {
          description: `Moved to ${
            statusLabels[updatedOrder.status] || updatedOrder.status
          }.`,
        })
      }
    }

    const handleSubmitted = (order: DraftOrder) => {
      upsertOrder(order, true)
    }

    const handleUpdated = (order: DraftOrder) => {
      upsertOrder(order)
    }

    socket.on("order:submitted", handleSubmitted)
    socket.on("order:updated", handleUpdated)

    socket.on("connect_error", (socketError) => {
      console.error("Kitchen socket error:", socketError.message)
    })

    return () => {
      socket.off("order:submitted", handleSubmitted)
      socket.off("order:updated", handleUpdated)
      socket.off("connect_error")
    }
  }, [])

  const groupedOrders = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.status,
          orders.filter((order) => order.status === column.status),
        ])
      ) as Record<KitchenStatus, DraftOrder[]>,
    [orders]
  )

  const totalItems = orders.reduce(
    (total, order) =>
      total +
      order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0),
    0
  )

  const oldestOrderMinutes =
    orders.length > 0
      ? Math.max(
          ...orders.map((order) => getOrderAgeInMinutes(order.createdAt))
        )
      : 0

  const handleAdvance = async (
    orderId: string,
    status: Exclude<KitchenStatus, "submitted">
  ) => {
    if (updatingId) return

    const previousStatus = orderStatusesRef.current.get(orderId)

    setUpdatingId(orderId)
    setError("")

    orderStatusesRef.current.set(orderId, status)

    try {
      const updatedOrder = await updateKitchenOrderStatus(orderId, status)

      if (shouldShowKitchenOrder(updatedOrder)) {
        orderStatusesRef.current.set(updatedOrder._id, updatedOrder.status)
      } else {
        orderStatusesRef.current.delete(updatedOrder._id)
      }

      setOrders((current) => {
        if (!shouldShowKitchenOrder(updatedOrder)) {
          return current.filter((order) => order._id !== orderId)
        }

        return current.map((order) =>
          order._id === orderId ? updatedOrder : order
        )
      })

      toast.success(`${updatedOrder.orderNumber} updated`, {
        description: `Order is now ${
          statusLabels[updatedOrder.status] || updatedOrder.status
        }.`,
      })
    } catch (requestError) {
      if (previousStatus) {
        orderStatusesRef.current.set(orderId, previousStatus)
      } else {
        orderStatusesRef.current.delete(orderId)
      }

      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not update order"

      setError(message)
      toast.error(message)

      await loadOrders()
    } finally {
      setUpdatingId("")
    }
  }

  const userInitial = user.name.trim().charAt(0).toUpperCase() || "K"

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const handleMobilePassword = () => {
    closeMobileMenu()
    navigate("/account/password")
  }

  const handleMobileLogout = () => {
    closeMobileMenu()
    onLogout()
  }

  return (
    <main className="h-svh overflow-hidden bg-[#f5f5f6]">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden">
        <header className="z-20 shrink-0 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ef1428] text-white md:size-12">
                <ChefHat className="size-6" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-[#ef1428] uppercase sm:text-xs sm:tracking-[0.2em]">
                  Live kitchen
                </p>

                <h1 className="truncate text-xl font-black tracking-tight md:text-2xl">
                  Kitchen board
                </h1>

                <p className="hidden truncate text-sm text-neutral-400 sm:block">
                  Signed in as {user.name}
                </p>
              </div>
            </div>

            <div className="hidden flex-wrap gap-2 xl:flex">
              <Button
                className="h-11 cursor-pointer rounded-xl"
                variant="outline"
                disabled={refreshing}
                onClick={() => void loadOrders(true)}
              >
                <RefreshCw
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                className="h-11 cursor-pointer rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>

              <Button
                className="h-11 cursor-pointer rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  className="size-11 shrink-0 cursor-pointer rounded-xl xl:hidden"
                  size="icon"
                  variant="outline"
                  aria-label="Open kitchen navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="flex h-full w-[88vw] max-w-md flex-col border-0 bg-white p-0"
              >
                <SheetHeader className="border-b border-neutral-100 px-6 py-6 text-left">
                  <div className="flex items-center gap-4 pr-10">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                      <ChefHat className="size-7" />
                    </div>

                    <div className="min-w-0">
                      <SheetTitle className="truncate text-2xl font-black">
                        Kitchen board
                      </SheetTitle>

                      <SheetDescription className="mt-1 truncate text-sm text-neutral-400">
                        Live preparation workspace
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <nav className="flex-1 space-y-2 overflow-y-auto px-5 py-6">
                  <Button
                    className="h-14 w-full cursor-pointer justify-start rounded-2xl bg-neutral-950 px-5 text-base font-bold text-white hover:bg-neutral-800"
                    variant="ghost"
                    onClick={closeMobileMenu}
                  >
                    <ChefHat className="mr-2 size-5" />
                    Kitchen board
                  </Button>

                  <Button
                    className="h-14 w-full cursor-pointer justify-start rounded-2xl px-5 text-base font-bold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                    variant="ghost"
                    disabled={refreshing}
                    onClick={() => {
                      closeMobileMenu()
                      void loadOrders(true)
                    }}
                  >
                    <RefreshCw
                      className={`mr-2 size-5 ${
                        refreshing ? "animate-spin" : ""
                      }`}
                    />
                    Refresh board
                  </Button>
                </nav>

                <div className="border-t border-neutral-100 p-5">
                  <div className="rounded-[24px] bg-neutral-100 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-lg font-black text-white">
                        {userInitial}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black">{user.name}</p>
                        <p className="truncate text-sm text-neutral-400">
                          Kitchen account
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Button
                        className="h-12 w-full cursor-pointer justify-center rounded-xl bg-white"
                        variant="outline"
                        onClick={handleMobilePassword}
                      >
                        <KeyRound className="size-4" />
                        Change password
                      </Button>

                      <Button
                        className="h-12 w-full cursor-pointer justify-center rounded-xl bg-white"
                        variant="outline"
                        onClick={handleMobileLogout}
                      >
                        <LogOut className="size-4" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <section className="mb-5 rounded-[24px] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="flex h-9 min-w-32 items-center justify-center rounded-xl border-0 bg-[#ef1428] px-4 py-2 text-sm font-semibold text-white">
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    `${orders.length} active orders`
                  )}
                </Badge>

                <Badge
                  variant="secondary"
                  className="flex h-9 min-w-36 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    `${totalItems} kitchen items`
                  )}
                </Badge>

                <Badge
                  className={`flex h-9 min-w-32 items-center justify-center rounded-xl border-0 px-4 py-2 text-sm font-semibold ${
                    !loading && oldestOrderMinutes >= 30
                      ? "bg-red-50 text-red-700"
                      : !loading && oldestOrderMinutes >= 15
                        ? "bg-amber-50 text-amber-700"
                        : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {loading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    <>
                      Oldest:{" "}
                      {orders.length
                        ? formatOrderAge(oldestOrderMinutes)
                        : "None"}
                    </>
                  )}
                </Badge>
              </div>

              <div className="flex h-9 min-w-28 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <span
                  className={`size-2 rounded-full bg-emerald-500 ${
                    loading ? "animate-pulse" : ""
                  }`}
                />
                Live updates
              </div>
            </div>
          </section>

          {error && (
            <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <KitchenColumnsSkeleton />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {columns.map((column) => {
                const Icon = column.icon
                const columnOrders = groupedOrders[column.status]

                return (
                  <section
                    key={column.status}
                    className="w-[340px] min-w-[340px] rounded-[24px] bg-[#ececee] p-3 xl:w-[calc((100%_-_48px)/4)] xl:min-w-0"
                  >
                    <div className="sticky top-0 z-10 rounded-2xl bg-[#ececee] px-2 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-9 items-center justify-center rounded-full text-white ${column.accent}`}
                          >
                            <Icon className="size-4" />
                          </div>

                          <div>
                            <h2 className="font-black">{column.title}</h2>
                            <p className="text-xs text-neutral-400">
                              {column.description}
                            </p>
                          </div>
                        </div>

                        <Badge
                          className={`rounded-full border-0 ${column.badge}`}
                        >
                          {columnOrders.length}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 max-h-[calc(100svh-290px)] space-y-3 overflow-y-auto pr-1">
                      {columnOrders.map((order) => (
                        <KitchenOrderCard
                          key={order._id}
                          order={order}
                          nextStatus={column.nextStatus}
                          action={column.action}
                          updating={updatingId === order._id}
                          onAdvance={handleAdvance}
                        />
                      ))}

                      {columnOrders.length === 0 && (
                        <div className="rounded-[20px] border border-dashed border-neutral-300 bg-white/50 p-8 text-center">
                          <UtensilsCrossed className="mx-auto size-6 text-neutral-300" />
                          <p className="mt-3 text-sm font-medium text-neutral-400">
                            No orders
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
