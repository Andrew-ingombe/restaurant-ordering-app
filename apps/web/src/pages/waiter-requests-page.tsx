import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { claimCustomerOrderRequest, getCustomerOrderRequests } from "../lib/api"
import type { DraftOrder } from "../lib/api"
import { getSocket } from "../lib/socket"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterRequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<DraftOrder[]>([])
  const [claimingId, setClaimingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadRequests = async () => {
    try {
      setError("")
      setRequests(await getCustomerOrderRequests())
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load customer requests"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const addRequest = (order: DraftOrder) => {
      setRequests((current) => {
        const exists = current.some((request) => request._id === order._id)

        return exists ? current : [...current, order]
      })
    }

    const removeRequest = (order: DraftOrder) => {
      setRequests((current) =>
        current.filter((request) => request._id !== order._id)
      )
    }

    socket.on("order:customer-requested", addRequest)
    socket.on("order:customer-claimed", removeRequest)

    return () => {
      socket.off("order:customer-requested", addRequest)
      socket.off("order:customer-claimed", removeRequest)
    }
  }, [])

  const claimRequest = async (orderId: string) => {
    setClaimingId(orderId)
    setError("")

    try {
      const order = await claimCustomerOrderRequest(orderId)
      navigate(`/waiter/orders/${order._id}`)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not claim request"
      )

      await loadRequests()
    } finally {
      setClaimingId("")
    }
  }

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">Customer Requests</h1>
            <p className="text-sm text-muted-foreground">
              QR menu selections waiting for a waiter.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadRequests()}>
              Refresh
            </Button>

            <Button onClick={() => navigate("/waiter")}>New order</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 md:p-6">
        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading customer requests...
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((order) => (
              <Card key={order._id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{order.tableName}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.orderNumber}
                      </p>
                    </div>

                    <Badge variant="secondary">Waiting</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium">
                      {order.customer.name || "Guest customer"}
                    </p>

                    {order.customer.phone && (
                      <p className="text-sm text-muted-foreground">
                        {order.customer.phone}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.menuItem}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span>
                            {item.quantity} × {item.name}
                          </span>
                          <span>{formatPrice(item.lineTotal)}</span>
                        </div>

                        {item.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between border-t pt-3 font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>

                  <Button
                    className="w-full"
                    disabled={claimingId === order._id}
                    onClick={() => void claimRequest(order._id)}
                  >
                    {claimingId === order._id
                      ? "Claiming..."
                      : "Claim and review"}
                  </Button>
                </CardContent>
              </Card>
            ))}

            {requests.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No customer requests are waiting.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
