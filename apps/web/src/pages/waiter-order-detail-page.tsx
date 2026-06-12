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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

import { getSocket } from "../lib/socket"

import { getMyOrder, initializePayment, verifyPayment } from "../lib/api"
import type { DraftOrder } from "../lib/api"
import { loadLencoScript } from "../lib/lenco"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterOrderDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [order, setOrder] = useState<DraftOrder | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!id) return

    void getMyOrder(id)
      .then((loadedOrder) => {
        setOrder(loadedOrder)
        setCustomerName(loadedOrder.customer.name || "")
        setCustomerPhone(loadedOrder.customer.phone || "")
        setCustomerEmail(loadedOrder.customer.email || "")
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load order"
        )
      })
  }, [id])

  useEffect(() => {
    const socket = getSocket()

    if (!socket || !id) return

    const updateOrder = (updatedOrder: DraftOrder) => {
      if (updatedOrder._id === id) {
        setOrder(updatedOrder)
      }
    }

    socket.on("order:updated", updateOrder)

    return () => {
      socket.off("order:updated", updateOrder)
    }
  }, [id])

  const handlePayment = async () => {
    if (!id || !order) return

    if (!customerName.trim()) {
      setError("Enter the customer name")
      return
    }

    if (!customerPhone.trim()) {
      setError("Enter the customer phone number")
      return
    }

    if (!customerEmail.trim()) {
      setError("Enter the customer email address")
      return
    }

    setProcessing(true)
    setError("")
    setMessage("")

    try {
      await loadLencoScript()

      const checkout = await initializePayment(id, {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
      })

      if (!window.LencoPay) {
        throw new Error("Lenco checkout is unavailable")
      }

      window.LencoPay.getPaid({
        key: import.meta.env.VITE_LENCO_PUBLIC_KEY,
        reference: checkout.reference,
        email: checkout.email,
        amount: checkout.amount,
        currency: checkout.currency,
        channels: ["card", "mobile-money"],
        customer: checkout.customer,

        onSuccess: async (paymentResponse) => {
          try {
            setMessage("Verifying payment...")

            const updatedOrder = await verifyPayment(
              id,
              paymentResponse.reference
            )

            setOrder(updatedOrder)
            setMessage("Payment confirmed. Order sent to kitchen.")
          } catch (verificationError) {
            setMessage("")
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : "Payment verification failed"
            )
          } finally {
            setProcessing(false)
          }
        },

        onClose: () => {
          setProcessing(false)
          setMessage("Payment window closed. You can try again.")
        },

        onConfirmationPending: () => {
          setProcessing(false)
          setMessage(
            "Payment confirmation is pending. Complete the authorization, then try again."
          )
        },
      })
    } catch (paymentError) {
      setProcessing(false)
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Could not start payment"
      )
    }
  }

  if (error && !order) {
    return (
      <main className="p-6">
        <p className="text-destructive">{error}</p>
      </main>
    )
  }

  if (!order) {
    return <main className="p-6 text-muted-foreground">Loading order...</main>
  }

  const canPay = ["draft", "awaiting_payment"].includes(order.status)

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

          {canPay && (
            <>
              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-name">Customer name</Label>
                  <Input
                    id="payment-name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-phone">Phone number</Label>
                  <Input
                    id="payment-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-email">Email address</Label>
                  <Input
                    id="payment-email"
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {message && <p className="text-sm text-green-600">{message}</p>}

          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => navigate("/waiter/orders")}
            >
              Back to orders
            </Button>

            {canPay && (
              <Button
                className="flex-1"
                disabled={processing}
                onClick={handlePayment}
              >
                {processing
                  ? "Processing..."
                  : `Pay ${formatPrice(order.total)}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
