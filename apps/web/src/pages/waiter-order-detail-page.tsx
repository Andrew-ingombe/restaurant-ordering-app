import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

import { getMyOrder } from "../lib/api"
import type { DraftOrder } from "../lib/api"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterOrderDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [order, setOrder] = useState<DraftOrder | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return

    void getMyOrder(id)
      .then(setOrder)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load order"
        )
      })
  }, [id])

  if (error) {
    return (
      <main className="p-6">
        <p className="text-destructive">{error}</p>
      </main>
    )
  }

  if (!order) {
    return <main className="p-6 text-muted-foreground">Loading order...</main>
  }

  return (
    <main className="min-h-svh bg-muted/40 p-4 md:p-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{order.orderNumber}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.tableName || "Takeaway"}
              </p>
            </div>

            <Badge className="capitalize">
              {order.status.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div>
            <p className="font-medium">
              {order.customer.name || "Walk-in customer"}
            </p>
            {order.customer.phone && (
              <p className="text-sm text-muted-foreground">
                {order.customer.phone}
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.menuItem}>
                <div className="flex justify-between gap-4">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span>{formatPrice(item.lineTotal)}</span>
                </div>

                {item.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Note: {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => navigate("/waiter/orders")}
            >
              Back to orders
            </Button>

            {order.status === "draft" && (
              <Button className="flex-1" disabled>
                Continue to payment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
