import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  Mail,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Send,
  Smartphone,
  UserRound,
  UtensilsCrossed,
  WalletCards,
  XCircle,
  ShieldCheck,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { OrderDetailSkeleton } from "../components/page-skeletons"

import { WaiterShell } from "../components/waiter-shell"
import {
  cancelOrder,
  getMyOrder,
  initializePayment,
  recordWaiterPayment,
  submitWaiterOrder,
  updateWaiterOrderStatus,
  verifyPayment,
  getRestaurantPaymentOptions,
} from "../lib/api"
import type {
  AuthUser,
  DraftOrder,
  ManualPaymentMethod,
  RestaurantPaymentOptions,
} from "../lib/api"
import { loadLencoScript } from "../lib/lenco"
import { getSocket } from "../lib/socket"

type WaiterOrderDetailPageProps = {
  user: AuthUser
  onLogout: () => void
}

type StatusConfig = {
  className: string
  icon: typeof Clock3
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatPaymentMethod = (method?: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    card_pos: "Card POS",
    manual_mobile_money: "Manual mobile money",
    lenco: "Lenco checkout",
  }

  return method ? labels[method] || formatStatus(method) : "Not recorded"
}

const statusConfig: Record<string, StatusConfig> = {
  draft: {
    className: "bg-neutral-100 text-neutral-700",
    icon: ReceiptText,
  },
  awaiting_payment: {
    className: "bg-amber-50 text-amber-700",
    icon: WalletCards,
  },
  submitted: {
    className: "bg-blue-50 text-blue-700",
    icon: ReceiptText,
  },
  accepted: {
    className: "bg-violet-50 text-violet-700",
    icon: CheckCircle2,
  },
  preparing: {
    className: "bg-amber-50 text-amber-700",
    icon: ChefHat,
  },
  ready: {
    className: "bg-emerald-50 text-emerald-700",
    icon: PackageCheck,
  },
  served: {
    className: "bg-cyan-50 text-cyan-700",
    icon: UtensilsCrossed,
  },
  completed: {
    className: "bg-neutral-950 text-white",
    icon: CheckCircle2,
  },
  cancelled: {
    className: "bg-red-50 text-red-700",
    icon: XCircle,
  },
}

const getStatusConfig = (status: string): StatusConfig =>
  statusConfig[status] || {
    className: "bg-neutral-100 text-neutral-700",
    icon: Clock3,
  }

const manualPaymentOptions: {
  method: ManualPaymentMethod
  label: string
  icon: typeof Banknote
}[] = [
  {
    method: "cash",
    label: "Cash",
    icon: Banknote,
  },
  {
    method: "card_pos",
    label: "Card POS",
    icon: CreditCard,
  },
  {
    method: "manual_mobile_money",
    label: "Mobile money",
    icon: Smartphone,
  },
]

export function WaiterOrderDetailPage({
  user,
  onLogout,
}: WaiterOrderDetailPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const [order, setOrder] = useState<DraftOrder | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [lencoProcessing, setLencoProcessing] = useState(false)
  const [manualProcessingMethod, setManualProcessingMethod] = useState<
    ManualPaymentMethod | ""
  >("")
  const [selectedManualPaymentMethod, setSelectedManualPaymentMethod] =
    useState<ManualPaymentMethod | null>(null)

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [paymentOptions, setPaymentOptions] =
    useState<RestaurantPaymentOptions>({
      manualMethods: ["cash", "card_pos", "manual_mobile_money"],
      lenco: {
        enabled: false,
        environment: "sandbox",
      },
    })
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(true)

  const orderSnapshotRef = useRef<DraftOrder | null>(null)
  const lencoSuccessReceivedRef = useRef(false)

  const applyOrderUpdate = (updatedOrder: DraftOrder) => {
    orderSnapshotRef.current = updatedOrder
    setOrder(updatedOrder)
  }

  const reportError = (requestError: unknown, fallback: string) => {
    const errorMessage =
      requestError instanceof Error ? requestError.message : fallback

    setError(errorMessage)
    toast.error(errorMessage)
  }

  useEffect(() => {
    if (!id) return

    orderSnapshotRef.current = null
    setOrder(null)
    setError("")
    setMessage("")

    void getMyOrder(id)
      .then((loadedOrder) => {
        applyOrderUpdate(loadedOrder)
        setCustomerName(loadedOrder.customer.name || "")
        setCustomerPhone(loadedOrder.customer.phone || "")
        setCustomerEmail(loadedOrder.customer.email || "")
      })
      .catch((requestError) => {
        reportError(requestError, "Could not load order")
      })
  }, [id])

  useEffect(() => {
    const socket = getSocket()

    if (!socket || !id) return

    const updateOrder = (updatedOrder: DraftOrder) => {
      if (updatedOrder._id !== id) return

      const previousOrder = orderSnapshotRef.current

      applyOrderUpdate(updatedOrder)

      if (previousOrder && previousOrder.status !== updatedOrder.status) {
        toast.info(`${updatedOrder.orderNumber} updated`, {
          id: `order-${updatedOrder._id}-${updatedOrder.status}`,
          description:
            updatedOrder.status === "ready"
              ? "The order is ready for collection."
              : `Order moved to ${formatStatus(updatedOrder.status)}.`,
        })
      }

      if (
        previousOrder &&
        previousOrder.paymentStatus !== "paid" &&
        updatedOrder.paymentStatus === "paid"
      ) {
        toast.success("Payment confirmed", {
          id: `payment-${updatedOrder._id}-paid`,
          description: `${updatedOrder.orderNumber} has been marked as paid.`,
        })
      }
    }

    socket.on("order:updated", updateOrder)

    return () => {
      socket.off("order:updated", updateOrder)
    }
  }, [id])

  useEffect(() => {
    let active = true

    void getRestaurantPaymentOptions()
      .then((options) => {
        if (active) {
          setPaymentOptions(options)
        }
      })
      .catch((requestError) => {
        if (!active) return

        toast.error(
          requestError instanceof Error
            ? requestError.message
            : "Could not load payment options",
          {
            id: "restaurant-payment-options",
          }
        )
      })
      .finally(() => {
        if (active) {
          setPaymentOptionsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const handleSubmitOrder = async () => {
    if (!order || submittingOrder) return

    setSubmittingOrder(true)
    setError("")
    setMessage("")

    try {
      const updatedOrder = await submitWaiterOrder(order._id)
      const successMessage =
        updatedOrder.status === "ready"
          ? "Order has no kitchen items, so it is ready to serve."
          : "Order sent to the kitchen."

      applyOrderUpdate(updatedOrder)
      setMessage(successMessage)

      toast.success(successMessage, {
        id: `order-${updatedOrder._id}-${updatedOrder.status}`,
      })
    } catch (requestError) {
      reportError(requestError, "Could not send order")
    } finally {
      setSubmittingOrder(false)
    }
  }

  const handleStatusChange = async (status: "served" | "completed") => {
    if (!order || updatingStatus) return

    setUpdatingStatus(true)
    setError("")
    setMessage("")

    try {
      const updatedOrder = await updateWaiterOrderStatus(order._id, status)

      const successMessage =
        status === "served"
          ? "Order marked as served. You can now collect payment."
          : "Order completed successfully."

      applyOrderUpdate(updatedOrder)
      setMessage(successMessage)

      toast.success(successMessage, {
        id: `order-${updatedOrder._id}-${updatedOrder.status}`,
      })
    } catch (requestError) {
      reportError(requestError, "Could not update order")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSelectManualPayment = (paymentMethod: ManualPaymentMethod) => {
    setError("")
    setMessage("")
    setSelectedManualPaymentMethod(paymentMethod)
  }

  const handleManualPayment = async (paymentMethod: ManualPaymentMethod) => {
    if (!order || manualProcessingMethod) return

    setManualProcessingMethod(paymentMethod)
    setError("")
    setMessage("")

    try {
      const updatedOrder = await recordWaiterPayment(order._id, paymentMethod)
      const successMessage = `${formatPaymentMethod(
        paymentMethod
      )} payment recorded.`

      applyOrderUpdate(updatedOrder)
      setSelectedManualPaymentMethod(null)
      setPaymentDialogOpen(false)
      setMessage(successMessage)

      toast.success(successMessage, {
        id: `payment-${updatedOrder._id}-paid`,
        description: formatPrice(updatedOrder.total),
      })
    } catch (requestError) {
      reportError(requestError, "Could not record payment")
    } finally {
      setManualProcessingMethod("")
    }
  }

  const handlePaymentDialogOpenChange = (open: boolean) => {
    if (manualProcessingMethod || lencoProcessing) return

    setPaymentDialogOpen(open)

    if (!open) {
      setSelectedManualPaymentMethod(null)
      setError("")
    }
  }

  const openPaymentDialog = () => {
    setSelectedManualPaymentMethod(null)
    setError("")
    setMessage("")
    setPaymentDialogOpen(true)
  }

  const handleCancelOrder = async () => {
    if (!order || cancelling) return

    setCancelling(true)
    setError("")
    setMessage("")

    try {
      const cancelledOrder = await cancelOrder(order._id)

      applyOrderUpdate(cancelledOrder)
      setMessage("Order cancelled successfully.")
      setCancelDialogOpen(false)

      toast.success("Order cancelled", {
        id: `order-${cancelledOrder._id}-cancelled`,
        description: cancelledOrder.orderNumber,
      })
    } catch (requestError) {
      reportError(requestError, "Could not cancel order")
    } finally {
      setCancelling(false)
    }
  }

  const handleLencoPayment = async () => {
    if (!id || !order) return

    if (order.status !== "served") {
      reportError(
        new Error("Serve the order before collecting payment."),
        "Serve the order before collecting payment."
      )
      return
    }

    if (!customerName.trim()) {
      reportError(
        new Error("Enter the customer name"),
        "Enter the customer name"
      )
      return
    }

    if (!customerPhone.trim()) {
      reportError(
        new Error("Enter the customer phone number"),
        "Enter the customer phone number"
      )
      return
    }

    if (!customerEmail.trim()) {
      reportError(
        new Error("Enter the customer email address"),
        "Enter the customer email address"
      )
      return
    }

    lencoSuccessReceivedRef.current = false
    setLencoProcessing(true)
    setSelectedManualPaymentMethod(null)
    setPaymentDialogOpen(false)
    setError("")
    setMessage("")

    // Allow the Shadcn dialog overlay and focus lock to unmount.
    await new Promise((resolve) => window.setTimeout(resolve, 200))

    try {
      const checkout = await initializePayment(id, {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: customerEmail.trim(),
      })

      await loadLencoScript(checkout.checkoutScriptUrl)

      if (!window.LencoPay) {
        throw new Error("Lenco checkout is unavailable")
      }

      window.LencoPay.getPaid({
        key: checkout.publicKey,
        reference: checkout.reference,
        email: checkout.email,
        amount: checkout.amount,
        currency: checkout.currency,
        channels: ["card", "mobile-money"],
        customer: checkout.customer,

        onSuccess: async (paymentResponse) => {
          lencoSuccessReceivedRef.current = true
          try {
            const updatedOrder = await verifyPayment(
              id,
              paymentResponse.reference
            )

            applyOrderUpdate(updatedOrder)
            setPaymentDialogOpen(false)
            setMessage("Payment confirmed. You can now complete the order.")

            toast.success("Lenco payment confirmed", {
              id: `payment-${updatedOrder._id}-paid`,
              description: `${updatedOrder.orderNumber} is now paid.`,
            })
          } catch (verificationError) {
            setMessage("")
            reportError(verificationError, "Payment verification failed")
          } finally {
            setLencoProcessing(false)
          }
        },

        onClose: () => {
          if (lencoSuccessReceivedRef.current) return
          setLencoProcessing(false)
          setMessage("Payment window closed. You can try again.")
          toast.info("Lenco payment window closed")

          window.setTimeout(() => {
            setPaymentDialogOpen(true)
          }, 200)
        },

        onConfirmationPending: () => {
          setLencoProcessing(false)
          setMessage(
            "Payment confirmation is pending. Complete the authorization, then verify again."
          )
          toast.warning("Payment confirmation is pending")
        },
      })
    } catch (paymentError) {
      setLencoProcessing(false)
      reportError(paymentError, "Could not start payment")

      window.setTimeout(() => {
        setPaymentDialogOpen(true)
      }, 200)
    }
  }

  if (error && !order) {
    return (
      <WaiterShell
        user={user}
        onLogout={onLogout}
        active="orders"
        title="Order details"
        description="Could not load this order."
        icon={<ReceiptText className="size-6" />}
      >
        <div className="mx-auto w-full max-w-md rounded-[24px] bg-white p-8 text-center">
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
      </WaiterShell>
    )
  }

  if (!order) {
    return (
      <WaiterShell
        user={user}
        onLogout={onLogout}
        active="orders"
        title="Order details"
        description="Loading order details..."
        icon={<ReceiptText className="size-6" />}
        contentScrollable={false}
        contentClassName="flex min-h-0 flex-col"
      >
        <OrderDetailSkeleton />
      </WaiterShell>
    )
  }

  const currentStatus = getStatusConfig(order.status)
  const StatusIcon = currentStatus.icon

  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0
  )

  const isDraft = order.status === "draft"
  const isServed = order.status === "served"
  const isPaid = order.paymentStatus === "paid"

  const canSubmitOrder = isDraft
  const canCancel =
    order.paymentStatus !== "paid" &&
    ["draft", "awaiting_payment"].includes(order.status)
  const canMarkServed = order.status === "ready"
  const canRecordPayment = isServed && !isPaid
  const canCompleteOrder = isServed && isPaid

  const actionBusy =
    submittingOrder ||
    lencoProcessing ||
    updatingStatus ||
    cancelling ||
    Boolean(manualProcessingMethod)

  const availableManualPaymentOptions = manualPaymentOptions.filter((option) =>
    paymentOptions.manualMethods.includes(option.method)
  )

  const selectedManualOption = manualPaymentOptions.find(
    (option) => option.method === selectedManualPaymentMethod
  )

  const SelectedManualPaymentIcon = selectedManualOption?.icon || WalletCards

  return (
    <WaiterShell
      user={user}
      onLogout={onLogout}
      active="orders"
      title={order.orderNumber}
      description={order.tableName || "Takeaway"}
      icon={<ReceiptText className="size-6" />}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-col gap-4"
    >
      <section className="shrink-0 rounded-[20px] bg-white p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            className="h-10 rounded-xl px-3"
            variant="outline"
            onClick={() => navigate("/waiter/orders")}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Orders</span>
          </Button>

          <Badge
            className={`flex h-10 rounded-xl border-0 px-4 capitalize ${currentStatus.className}`}
          >
            <StatusIcon className="size-4" />
            {formatStatus(order.status)}
          </Badge>

          <div className="hidden h-10 items-center rounded-xl bg-neutral-100 px-4 text-sm font-semibold text-neutral-600 sm:flex">
            {order.tableName || "Takeaway"}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <Badge
              className={`hidden h-10 rounded-xl border-0 px-4 capitalize sm:flex ${
                isPaid
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              <WalletCards className="size-4" />
              {formatStatus(order.paymentStatus)}
            </Badge>

            <span className="truncate text-lg font-black text-[#047857] sm:text-xl">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain pr-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">Ordered items</h2>

                <p className="mt-1 text-sm text-neutral-400">
                  {itemCount} {itemCount === 1 ? "item" : "items"} in this order
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

                        <p className="shrink-0 font-black text-[#047857]">
                          {formatPrice(item.lineTotal)}
                        </p>
                      </div>

                      {item.notes && (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <span className="font-bold">Note:</span> {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[24px] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#047857] uppercase">
                  Customer
                </p>

                <h2 className="mt-1 text-lg font-black">Contact details</h2>
              </div>

              <div className="flex size-10 items-center justify-center rounded-full bg-neutral-100">
                <UserRound className="size-4" />
              </div>
            </div>

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

                <p className="mt-1 text-sm text-white/50">
                  {formatPaymentMethod(order.paymentMethod)}
                </p>
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

            {isDraft && (
              <Button
                className="mt-5 h-12 w-full rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                variant="outline"
                onClick={() => navigate(`/waiter/orders/${order._id}/edit`)}
              >
                Edit draft order
              </Button>
            )}

            {canSubmitOrder && (
              <Button
                className="mt-3 h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                disabled={actionBusy}
                onClick={handleSubmitOrder}
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Send order
                  </>
                )}
              </Button>
            )}

            {canRecordPayment && (
              <Button
                className="mt-3 h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                disabled={actionBusy}
                onClick={openPaymentDialog}
              >
                <WalletCards className="size-4" />
                Collect payment
              </Button>
            )}

            {canCancel && (
              <Button
                className="mt-3 h-12 w-full rounded-xl border-red-200 text-red-500 hover:bg-red-500/20 hover:text-white"
                variant="outline"
                disabled={actionBusy}
                onClick={() => setCancelDialogOpen(true)}
              >
                <XCircle className="size-4" />
                Cancel order
              </Button>
            )}
          </div>

          {error && !paymentDialogOpen && (
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

          {canMarkServed && (
            <Button
              className="h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
              disabled={actionBusy}
              onClick={() => handleStatusChange("served")}
            >
              {updatingStatus ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <UtensilsCrossed className="size-4" />
                  Mark served
                </>
              )}
            </Button>
          )}

          {canCompleteOrder && (
            <Button
              className="h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
              disabled={actionBusy}
              onClick={() => handleStatusChange("completed")}
            >
              {updatingStatus ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Complete order
                </>
              )}
            </Button>
          )}
        </aside>
      </div>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={handlePaymentDialogOpenChange}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto rounded-[28px] border-0 bg-[#f5f5f6] p-0 sm:max-w-2xl">
          {selectedManualPaymentMethod ? (
            <div className="p-5 md:p-6">
              <DialogHeader className="text-left">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                  <SelectedManualPaymentIcon className="size-5" />
                </div>

                <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-[#047857] uppercase">
                  Confirm payment
                </p>

                <DialogTitle className="mt-1 text-2xl font-black">
                  Record {formatPaymentMethod(selectedManualPaymentMethod)}
                </DialogTitle>

                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Confirm the payment only after receiving the full amount.
                </p>
              </DialogHeader>

              <div className="mt-6 rounded-[22px] bg-neutral-950 p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.16em] text-white/50 uppercase">
                      Amount received
                    </p>

                    <p className="mt-2 text-3xl font-black">
                      {formatPrice(order.total)}
                    </p>
                  </div>

                  <Badge className="rounded-full border-0 bg-white/10 text-white">
                    {formatPaymentMethod(selectedManualPaymentMethod)}
                  </Badge>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                  <span className="text-white/50">Order</span>
                  <span className="font-bold">{order.orderNumber}</span>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                <p>
                  This records the order as paid. Make sure the restaurant has
                  received the full amount before continuing.
                </p>
              </div>

              {error && (
                <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-xl bg-white"
                  variant="outline"
                  disabled={Boolean(manualProcessingMethod)}
                  onClick={() => {
                    setError("")
                    setSelectedManualPaymentMethod(null)
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Choose another method
                </Button>

                <Button
                  className="h-12 rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                  disabled={Boolean(manualProcessingMethod)}
                  onClick={() =>
                    void handleManualPayment(selectedManualPaymentMethod)
                  }
                >
                  {manualProcessingMethod ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Confirm payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white p-5 md:p-6">
                <DialogHeader className="text-left">
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#047857] uppercase">
                    Collect payment
                  </p>

                  <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <DialogTitle className="text-2xl font-black">
                        Choose payment method
                      </DialogTitle>

                      <p className="mt-2 text-sm leading-6 text-neutral-500">
                        Record how the customer is paying for this order.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#ECFDF5] px-4 py-3 text-right">
                      <p className="text-xs font-semibold text-[#047857]">
                        Amount due
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#047857]">
                        {formatPrice(order.total)}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="space-y-4 p-5 pt-0 md:p-6 md:pt-0">
                <section className="rounded-[22px] bg-white p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Record payment</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        Select the method confirmed by the customer.
                      </p>
                    </div>

                    <Badge variant="secondary" className="rounded-full">
                      {order.orderNumber}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {availableManualPaymentOptions.map((option) => {
                      const Icon = option.icon

                      return (
                        <Button
                          key={option.method}
                          className="h-auto min-h-20 justify-start gap-3 rounded-2xl border-neutral-200 bg-white p-4 text-left hover:border-neutral-300 hover:bg-neutral-50 sm:flex-col sm:items-center sm:justify-center sm:text-center"
                          variant="outline"
                          disabled={actionBusy}
                          onClick={() =>
                            handleSelectManualPayment(option.method)
                          }
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                            <Icon className="size-4" />
                          </span>

                          <span className="font-black text-neutral-950">
                            {option.label}
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                </section>

                {paymentOptionsLoading && (
                  <div className="flex items-center justify-center gap-2 rounded-[22px] bg-white p-5 text-sm text-neutral-400">
                    <RefreshCw className="size-4 animate-spin" />
                    Checking online payment availability...
                  </div>
                )}

                {!paymentOptionsLoading && paymentOptions.lenco.enabled && (
                  <section className="rounded-[22px] bg-white p-4 md:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#047857] text-white">
                        <WalletCards className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black">Lenco checkout</h3>

                          {paymentOptions.lenco.environment === "sandbox" && (
                            <Badge className="rounded-full border-0 bg-amber-50 text-amber-700">
                              Sandbox
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 text-sm leading-6 text-neutral-400">
                          Secure card or mobile-money checkout through Lenco.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl bg-neutral-100 p-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment-name">Customer name</Label>
                        <Input
                          id="payment-name"
                          className="h-12 rounded-xl border-0 bg-white px-4 shadow-none"
                          value={customerName}
                          onChange={(event) =>
                            setCustomerName(event.target.value)
                          }
                          placeholder="Full name"
                          disabled={actionBusy}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-phone">Phone number</Label>
                        <Input
                          id="payment-phone"
                          className="h-12 rounded-xl border-0 bg-white px-4 shadow-none"
                          type="tel"
                          value={customerPhone}
                          onChange={(event) =>
                            setCustomerPhone(event.target.value)
                          }
                          placeholder="Phone number"
                          disabled={actionBusy}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="payment-email">Email address</Label>
                        <Input
                          id="payment-email"
                          className="h-12 rounded-xl border-0 bg-white px-4 shadow-none"
                          type="email"
                          value={customerEmail}
                          onChange={(event) =>
                            setCustomerEmail(event.target.value)
                          }
                          placeholder="Email address"
                          disabled={actionBusy}
                        />
                      </div>

                      <Button
                        className="h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                        disabled={actionBusy}
                        onClick={handleLencoPayment}
                      >
                        {lencoProcessing ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            Opening checkout...
                          </>
                        ) : (
                          <>
                            <WalletCards className="size-4" />
                            Continue with Lenco
                          </>
                        )}
                      </Button>
                    </div>
                  </section>
                )}

                {error && (
                  <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                will be cancelled. Paid orders should not be cancelled here.
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
    </WaiterShell>
  )
}
