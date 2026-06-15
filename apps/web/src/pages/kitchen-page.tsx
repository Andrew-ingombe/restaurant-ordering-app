import { useEffect, useMemo, useState } from "react"
import {
  BellRing,
  Check,
  ChefHat,
  Clock3,
  CookingPot,
  LogOut,
  PackageCheck,
  RefreshCw,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { getKitchenOrders, updateKitchenOrderStatus } from "../lib/api"
import type { AuthUser, DraftOrder, KitchenStatus } from "../lib/api"
import { getSocket } from "../lib/socket"

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
    description: "Waiting to be accepted",
    nextStatus: "accepted",
    action: "Accept order",
    icon: BellRing,
    accent: "bg-[#ef1428]",
    badge: "bg-red-50 text-red-700",
  },
  {
    status: "accepted",
    title: "Accepted",
    description: "Queued for preparation",
    nextStatus: "preparing",
    action: "Start preparing",
    icon: Check,
    accent: "bg-neutral-950",
    badge: "bg-neutral-100 text-neutral-700",
  },
  {
    status: "preparing",
    title: "Preparing",
    description: "Currently being prepared",
    nextStatus: "ready",
    action: "Mark ready",
    icon: CookingPot,
    accent: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700",
  },
  {
    status: "ready",
    title: "Ready",
    description: "Waiting for the waiter",
    icon: PackageCheck,
    accent: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
]

const getOrderAge = (createdAt: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )

  if (minutes < 1) return "Just now"
  if (minutes === 1) return "1 min"
  if (minutes < 60) return `${minutes} mins`

  const hours = Math.floor(minutes / 60)

  return `${hours}h ${minutes % 60}m`
}

const getAgeStyle = (createdAt: string) => {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  )

  if (minutes >= 30) {
    return "bg-red-50 text-red-700"
  }

  if (minutes >= 15) {
    return "bg-amber-50 text-amber-700"
  }

  return "bg-neutral-100 text-neutral-600"
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
            className="mt-4 h-11 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
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
  const [, setClock] = useState(Date.now())

  const loadOrders = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    }

    try {
      setError("")
      setOrders(await getKitchenOrders())
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

    const upsertOrder = (updatedOrder: DraftOrder) => {
      setOrders((current) => {
        const activeStatuses = ["submitted", "accepted", "preparing", "ready"]

        if (!activeStatuses.includes(updatedOrder.status)) {
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
    }

    socket.on("order:submitted", upsertOrder)
    socket.on("order:updated", upsertOrder)

    socket.on("connect_error", (socketError) => {
      console.error("Kitchen socket error:", socketError.message)
    })

    return () => {
      socket.off("order:submitted", upsertOrder)
      socket.off("order:updated", upsertOrder)
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

  const handleAdvance = async (
    orderId: string,
    status: Exclude<KitchenStatus, "submitted">
  ) => {
    setUpdatingId(orderId)
    setError("")

    try {
      const updatedOrder = await updateKitchenOrderStatus(orderId, status)

      setOrders((current) =>
        current.map((order) => (order._id === orderId ? updatedOrder : order))
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update order"
      )

      await loadOrders()
    } finally {
      setUpdatingId("")
    }
  }

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-[1800px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#ef1428] text-white">
                <ChefHat className="size-6" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Live kitchen
                </p>
                <h1 className="text-2xl font-black tracking-tight">
                  Kitchen board
                </h1>
                <p className="text-sm text-neutral-400">
                  Signed in as {user.name}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="hidden items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 sm:flex">
                <span className="size-2 rounded-full bg-emerald-500" />
                Live updates
              </div>

              <Button
                className="h-11 rounded-xl"
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
                className="h-11 rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {columns.map((column) => {
              const Icon = column.icon
              const count = groupedOrders[column.status]?.length || 0

              return (
                <div
                  key={column.status}
                  className="rounded-[20px] bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-9 items-center justify-center rounded-full text-white ${column.accent}`}
                    >
                      <Icon className="size-4" />
                    </div>

                    <p className="text-2xl font-black">{count}</p>
                  </div>

                  <p className="mt-4 font-bold">{column.title}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {column.description}
                  </p>
                </div>
              )
            })}
          </section>

          {error && (
            <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex min-h-96 items-center justify-center">
              <div className="text-center">
                <RefreshCw className="mx-auto size-6 animate-spin text-[#ef1428]" />
                <p className="mt-3 text-sm text-neutral-400">
                  Loading kitchen orders...
                </p>
              </div>
            </div>
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
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-2xl bg-[#ececee] px-2 py-2">
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
