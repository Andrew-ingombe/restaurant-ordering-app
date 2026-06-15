import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  UserRound,
  UtensilsCrossed,
  WalletCards,
  XCircle,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import {
  getMyOrder,
  initializePayment,
  updateWaiterOrderStatus,
  verifyPayment,
  cancelOrder,
} from "../lib/api"
import type { DraftOrder } from "../lib/api"
import { loadLencoScript } from "../lib/lenco"
import { getSocket } from "../lib/socket"

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const statusConfig: Record<
  string,
  {
    className: string
    accent: string
    icon: typeof Clock3
    description: string
  }
> = {
  draft: {
    className: "bg-neutral-100 text-neutral-700",
    accent: "bg-neutral-950",
    icon: ReceiptText,
    description: "Order is ready for payment",
  },
  awaiting_payment: {
    className: "bg-amber-50 text-amber-700",
    accent: "bg-amber-400",
    icon: WalletCards,
    description: "Waiting for payment confirmation",
  },
  submitted: {
    className: "bg-blue-50 text-blue-700",
    accent: "bg-blue-500",
    icon: ReceiptText,
    description: "Order has been sent to the kitchen",
  },
  accepted: {
    className: "bg-violet-50 text-violet-700",
    accent: "bg-violet-500",
    icon: CheckCircle2,
    description: "Kitchen has accepted the order",
  },
  preparing: {
    className: "bg-amber-50 text-amber-700",
    accent: "bg-amber-400",
    icon: ChefHat,
    description: "Kitchen is preparing the order",
  },
  ready: {
    className: "bg-emerald-50 text-emerald-700",
    accent: "bg-emerald-500",
    icon: PackageCheck,
    description: "Order is ready to serve",
  },
  served: {
    className: "bg-cyan-50 text-cyan-700",
    accent: "bg-cyan-500",
    icon: UtensilsCrossed,
    description: "Order has been served",
  },
  completed: {
    className: "bg-neutral-950 text-white",
    accent: "bg-neutral-950",
    icon: CheckCircle2,
    description: "Order has been completed",
  },
}

const getStatusConfig = (status: string) =>
  statusConfig[status] || {
    className: "bg-neutral-100 text-neutral-700",
    accent: "bg-neutral-400",
    icon: Clock3,
    description: "Order status updated",
  }

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
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const handleStatusChange = async (status: "served" | "completed") => {
    if (!order) return

    setUpdatingStatus(true)
    setError("")
    setMessage("")

    try {
      const updatedOrder = await updateWaiterOrderStatus(order._id, status)

      setOrder(updatedOrder)
      setMessage(`Order marked as ${status}`)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update order"
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!order) return

    setCancelling(true)
    setError("")
    setMessage("")

    try {
      const cancelledOrder = await cancelOrder(order._id)

      setOrder(cancelledOrder)
      setMessage("Order cancelled successfully")
      setCancelDialogOpen(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not cancel order"
      )
    } finally {
      setCancelling(false)
    }
  }

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
      <main className="flex min-h-svh items-center justify-center bg-[#252323] p-4">
        <div className="w-full max-w-md rounded-[24px] bg-white p-8 text-center">
          <p className="text-red-700">{error}</p>

          <Button
            className="mt-5 rounded-xl"
            variant="outline"
            onClick={() => navigate("/waiter/orders")}
          >
            <ArrowLeft className="size-4" />
            Back to orders
          </Button>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div className="text-center text-white">
          <RefreshCw className="mx-auto size-6 animate-spin" />
          <p className="mt-3 text-sm text-white/60">Loading order...</p>
        </div>
      </main>
    )
  }

  const canPay = ["draft", "awaiting_payment"].includes(order.status)

  const nextWaiterStatus =
    order.status === "ready"
      ? "served"
      : order.status === "served"
        ? "completed"
        : null

  const currentStatus = getStatusConfig(order.status)
  const StatusIcon = currentStatus.icon

  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0
  )

  return (
    <main className="min-h-svh">
      <div className="mx-auto min-h-[calc(100svh-24px)] max-w-6xl overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                className="size-11 rounded-xl"
                size="icon"
                variant="outline"
                onClick={() => navigate("/waiter/orders")}
              >
                <ArrowLeft className="size-4" />
              </Button>

              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
                  Order details
                </p>

                <h1 className="text-2xl font-black tracking-tight">
                  {order.orderNumber}
                </h1>

                <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-400">
                  <MapPin className="size-3.5" />
                  {order.tableName || "Takeaway"}
                </p>
              </div>
            </div>

            <Badge
              className={`rounded-full border-0 px-4 py-2 capitalize ${currentStatus.className}`}
            >
              <StatusIcon className="size-4" />
              {formatStatus(order.status)}
            </Badge>
          </div>
        </header>

        <div className="grid gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="rounded-[24px] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                    Current progress
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {formatStatus(order.status)}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {currentStatus.description}
                  </p>
                </div>

                <div
                  className={`flex size-12 items-center justify-center rounded-full text-white ${currentStatus.accent}`}
                >
                  <StatusIcon className="size-5" />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Ordered items</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {itemCount} {itemCount === 1 ? "item" : "items"} in this
                    order
                  </p>
                </div>

                <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                  <ReceiptText className="size-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.menuItem}-${index}`}
                    className="rounded-2xl border border-neutral-100 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-black text-white">
                        {item.quantity}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-bold">{item.name}</p>
                            <p className="mt-1 text-xs text-neutral-400">
                              {formatPrice(item.unitPrice)} each
                            </p>
                          </div>

                          <p className="shrink-0 font-black text-[#ef1428]">
                            {formatPrice(item.lineTotal)}
                          </p>
                        </div>

                        {item.notes && (
                          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            <span className="font-bold">Note:</span>{" "}
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-5">
                <span className="font-bold">Order total</span>
                <span className="text-2xl font-black text-[#ef1428]">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[24px] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#ef1428] uppercase">
                    Customer
                  </p>
                  <h2 className="mt-1 text-lg font-black">Contact details</h2>
                </div>

                <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                  <UserRound className="size-4" />
                </div>
              </div>

              {canPay ? (
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-name">Customer name</Label>
                    <Input
                      id="payment-name"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-phone">Phone number</Label>
                    <Input
                      id="payment-phone"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-email">Email address</Label>
                    <Input
                      id="payment-email"
                      className="h-12 rounded-xl border-0 bg-neutral-100 px-4 shadow-none"
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      placeholder="Email address"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-neutral-100 p-3">
                    <UserRound className="size-4 text-neutral-400" />
                    <span className="text-sm">
                      {order.customer.name || "Guest customer"}
                    </span>
                  </div>

                  {order.customer.phone && (
                    <div className="flex items-center gap-3 rounded-xl bg-neutral-100 p-3">
                      <Phone className="size-4 text-neutral-400" />
                      <span className="text-sm">{order.customer.phone}</span>
                    </div>
                  )}

                  {order.customer.email && (
                    <div className="flex items-center gap-3 rounded-xl bg-neutral-100 p-3">
                      <Mail className="size-4 text-neutral-400" />
                      <span className="truncate text-sm">
                        {order.customer.email}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[24px] bg-neutral-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs tracking-[0.16em] text-white/50 uppercase">
                    Payment
                  </p>
                  <h2 className="mt-1 text-lg font-black capitalize">
                    {order.paymentStatus}
                  </h2>
                </div>

                <div className="flex size-10 items-center justify-center rounded-full bg-white/10">
                  <CreditCard className="size-4" />
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between">
                <span className="text-sm text-white/50">Amount due</span>
                <span className="text-2xl font-black">
                  {formatPrice(order.total)}
                </span>
              </div>

              {canPay && order.status === "draft" && (
                <Button
                  className="mt-5 h-12 w-full rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                  variant="outline"
                  onClick={() => navigate(`/waiter/orders/${order._id}/edit`)}
                >
                  Edit draft order
                </Button>
              )}

              {canPay && (
                <Button
                  className="mt-3 h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                  disabled={processing}
                  onClick={handlePayment}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <WalletCards className="size-4" />
                      Pay {formatPrice(order.total)}
                    </>
                  )}
                </Button>
              )}

              {canPay && (
                <Button
                  className="mt-3 h-12 w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  variant="outline"
                  disabled={cancelling || processing}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  <XCircle className="size-4" />
                  Cancel order
                </Button>
              )}
            </div>

            {error && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}

            {message && (
              <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                <Check className="mt-0.5 size-4 shrink-0" />
                {message}
              </p>
            )}

            {nextWaiterStatus && (
              <Button
                className="h-12 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
                disabled={updatingStatus}
                onClick={() => handleStatusChange(nextWaiterStatus)}
              >
                {updatingStatus ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Updating...
                  </>
                ) : nextWaiterStatus === "served" ? (
                  <>
                    <UtensilsCrossed className="size-4" />
                    Mark served
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Complete order
                  </>
                )}
              </Button>
            )}

            <Button
              className="h-12 w-full rounded-xl"
              variant="outline"
              onClick={() => navigate("/waiter/orders")}
            >
              <ArrowLeft className="size-4" />
              Back to orders
            </Button>
          </aside>
        </div>
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="rounded-[24px] border-0 p-0 sm:max-w-md">
          <div className="p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <XCircle className="size-6" />
            </div>

            <AlertDialogHeader className="mt-5 text-left">
              <AlertDialogTitle className="text-xl font-black">
                Cancel this order?
              </AlertDialogTitle>

              <AlertDialogDescription className="leading-6">
                Order{" "}
                <strong className="text-neutral-900">
                  {order.orderNumber}
                </strong>{" "}
                will be cancelled and cannot continue to payment or the kitchen.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-5 rounded-2xl bg-neutral-100 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {order.tableName || "Takeaway"}
                </span>

                <span className="font-black text-neutral-950">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>

            <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
              <AlertDialogCancel
                className="h-11 rounded-xl"
                disabled={cancelling}
              >
                Keep order
              </AlertDialogCancel>

              <AlertDialogAction
                className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700"
                disabled={cancelling}
                onClick={(event) => {
                  event.preventDefault()
                  void handleCancelOrder()
                }}
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="size-4" />
                    Cancel order
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
