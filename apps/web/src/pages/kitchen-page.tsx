import { useEffect, useMemo, useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

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
  nextStatus?: Exclude<KitchenStatus, "submitted">
  action?: string
}[] = [
  {
    status: "submitted",
    title: "New",
    nextStatus: "accepted",
    action: "Accept order",
  },
  {
    status: "accepted",
    title: "Accepted",
    nextStatus: "preparing",
    action: "Start preparing",
  },
  {
    status: "preparing",
    title: "Preparing",
    nextStatus: "ready",
    action: "Mark ready",
  },
  {
    status: "ready",
    title: "Ready",
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
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{order.orderNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.tableName || "Takeaway"}
            </p>
          </div>

          <Badge variant="secondary">{getOrderAge(order.createdAt)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.menuItem}>
              <div className="flex gap-2 font-medium">
                <span>{item.quantity}×</span>
                <span>{item.name}</span>
              </div>

              {item.notes && (
                <p className="mt-1 ml-6 rounded bg-yellow-50 px-2 py-1 text-sm text-yellow-900">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground">
          Waiter: {order.waiter?.name || "Unknown"}
        </div>

        {nextStatus && action && (
          <Button
            className="w-full"
            disabled={updating}
            onClick={() => onAdvance(order._id, nextStatus)}
          >
            {updating ? "Updating..." : action}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function KitchenPage({ user, onLogout }: KitchenPageProps) {
  const [orders, setOrders] = useState<DraftOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState("")
  const [error, setError] = useState("")
  const [, setClock] = useState(Date.now())

  const loadOrders = async () => {
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
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">Kitchen Board</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadOrders()}>
              Refresh
            </Button>
            <Button variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] p-4">
        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading kitchen orders...
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            {columns.map((column) => (
              <section key={column.status}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">{column.title}</h2>
                  <Badge variant="outline">
                    {groupedOrders[column.status].length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {groupedOrders[column.status].map((order) => (
                    <KitchenOrderCard
                      key={order._id}
                      order={order}
                      nextStatus={column.nextStatus}
                      action={column.action}
                      updating={updatingId === order._id}
                      onAdvance={handleAdvance}
                    />
                  ))}

                  {groupedOrders[column.status].length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No orders
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
