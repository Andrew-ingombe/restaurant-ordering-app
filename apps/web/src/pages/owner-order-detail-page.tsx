import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Clock3,
  Mail,
  Phone,
  QrCode,
  ReceiptText,
  UserRound,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { OwnerShell } from "../components/owner-shell"
import { getOwnerOrder } from "../lib/api"
import type { AuthUser, OwnerOrder } from "../lib/api"

type OwnerOrderDetailPageProps = {
  user: AuthUser
  onLogout: () => void
}

const statusStyles: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700",
  awaiting_waiter: "bg-orange-50 text-orange-700",
  awaiting_payment: "bg-yellow-50 text-yellow-700",
  submitted: "bg-blue-50 text-blue-700",
  accepted: "bg-violet-50 text-violet-700",
  preparing: "bg-amber-50 text-amber-700",
  ready: "bg-emerald-50 text-emerald-700",
  served: "bg-cyan-50 text-cyan-700",
  completed: "bg-neutral-950 text-white",
  cancelled: "bg-red-50 text-red-700",
}

const paymentStyles: Record<string, string> = {
  unpaid: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-violet-50 text-violet-700",
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(amount / 100)

const formatStatus = (status: string) => status.replaceAll("_", " ")

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-ZM", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value))

export function OwnerOrderDetailPage({
  user,
  onLogout,
}: OwnerOrderDetailPageProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  const [order, setOrder] = useState<OwnerOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) {
      setError("Order ID is missing")
      setLoading(false)
      return
    }

    let active = true

    void getOwnerOrder(id)
      .then((result) => {
        if (active) setOrder(result)
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load order"
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  return (
    <OwnerShell
      user={user}
      onLogout={onLogout}
      active="orders"
      headerContent={
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            className="size-11 rounded-xl"
            aria-label="Back to orders"
            onClick={() => navigate("/owner/orders")}
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#ef1428] uppercase">
              Order record
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight md:text-3xl">
              {order?.orderNumber || "Order details"}
            </h1>
          </div>
        </div>
      }
    >
      {loading && (
        <div className="flex min-h-96 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading order...</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 p-5 text-red-700">
          <p className="font-bold">Could not load order</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {order && (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-5">
            <section className="rounded-[24px] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-400">Order number</p>
                  <h2 className="mt-1 text-2xl font-black">
                    {order.orderNumber}
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={`border-0 capitalize ${
                      statusStyles[order.status]
                    }`}
                  >
                    {formatStatus(order.status)}
                  </Badge>

                  <Badge
                    className={`border-0 capitalize ${
                      paymentStyles[order.paymentStatus] || paymentStyles.unpaid
                    }`}
                  >
                    {formatStatus(order.paymentStatus)}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-5">
              <div>
                <h2 className="text-lg font-black">Order items</h2>
                <p className="text-sm text-neutral-400">
                  {order.items.length} item positions
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.menuItem}-${index}`}
                    className="rounded-2xl border border-dashed border-neutral-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="mt-1 text-sm text-neutral-400">
                          {item.quantity} × {formatPrice(item.unitPrice)}
                        </p>
                      </div>

                      <p className="font-black text-[#ef1428]">
                        {formatPrice(item.lineTotal)}
                      </p>
                    </div>

                    {item.notes && (
                      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Note: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t border-dashed border-neutral-200 pt-5">
                <div className="flex justify-between text-sm text-neutral-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>

                <div className="flex justify-between text-xl font-black">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[24px] bg-neutral-950 p-5 text-white">
              <div className="flex size-11 items-center justify-center rounded-full bg-white/10">
                <ReceiptText className="size-5" />
              </div>

              <p className="mt-5 text-sm text-white/55">Order total</p>
              <p className="mt-1 text-3xl font-black">
                {formatPrice(order.total)}
              </p>

              <div className="mt-5 border-t border-white/10 pt-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/55">Currency</span>
                  <span className="font-bold">{order.currency}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-5">
              <h2 className="font-black">Service details</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <UtensilsCrossed className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Order type</p>
                    <p className="font-bold capitalize">
                      {formatStatus(order.orderType)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <QrCode className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Source</p>
                    <p className="font-bold capitalize">
                      {formatStatus(order.source || "waiter")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Table</p>
                    <p className="font-bold">{order.tableName || "Takeaway"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <UserRound className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Waiter</p>
                    <p className="font-bold">
                      {order.waiter?.name || "Unassigned"}
                    </p>
                    {order.waiter?.email && (
                      <p className="text-xs text-neutral-400">
                        {order.waiter.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] bg-white p-5">
              <h2 className="font-black">Customer</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <UserRound className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Name</p>
                    <p className="font-bold">
                      {order.customer?.name || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Phone</p>
                    <p className="font-bold">
                      {order.customer?.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Email</p>
                    <p className="font-bold break-all">
                      {order.customer?.email || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <WalletCards className="mt-0.5 size-4 text-neutral-400" />
                  <div>
                    <p className="text-neutral-400">Payment</p>
                    <p className="font-bold capitalize">
                      {formatStatus(order.paymentStatus)}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </OwnerShell>
  )
}
