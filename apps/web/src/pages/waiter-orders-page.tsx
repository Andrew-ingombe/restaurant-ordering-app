import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { getSocket } from "../lib/socket"

import { getMyOrders } from "../lib/api"
import type { DraftOrder } from "../lib/api"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

export function WaiterOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<DraftOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void getMyOrders()
      .then(setOrders)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load orders"
        )
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const updateOrder = (updatedOrder: DraftOrder) => {
      setOrders((current) =>
        current.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      )
    }

    socket.on("order:updated", updateOrder)

    return () => {
      socket.off("order:updated", updateOrder)
    }
  }, [])

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">My Orders</h1>
            <p className="text-sm text-muted-foreground">
              Draft and active orders
            </p>
          </div>

          <Button onClick={() => navigate("/waiter")}>Create new order</Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <Card key={order._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{order.orderNumber}</CardTitle>
                    <CardDescription>
                      {new Date(order.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>

                  <Badge className="capitalize">
                    {formatStatus(order.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order</span>
                  <span className="capitalize">
                    {formatStatus(order.orderType)}
                  </span>
                </div>

                {order.tableName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Table</span>
                    <span>{order.tableName}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items</span>
                  <span>
                    {order.items.reduce(
                      (total, item) => total + item.quantity,
                      0
                    )}
                  </span>
                </div>

                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>

                <Badge
                  variant={
                    order.paymentStatus === "paid" ? "default" : "secondary"
                  }
                  className="capitalize"
                >
                  Payment: {order.paymentStatus}
                </Badge>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate(`/waiter/orders/${order._id}`)}
                >
                  View order
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && orders.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              You have not created any orders yet.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
