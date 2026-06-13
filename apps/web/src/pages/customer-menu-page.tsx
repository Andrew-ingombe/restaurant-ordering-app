import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"

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
import { Textarea } from "@workspace/ui/components/textarea"

import { getCustomerTableMenu, submitCustomerOrder } from "../lib/api"
import type {
  CustomerOrderResponse,
  CustomerTableMenu,
  PublicMenuItem,
} from "../lib/api"

type CartItem = {
  item: PublicMenuItem
  quantity: number
  notes: string
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function CustomerMenuPage() {
  const { token } = useParams()
  const [menu, setMenu] = useState<CustomerTableMenu | null>(null)
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [categoryId, setCategoryId] = useState("all")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [result, setResult] = useState<CustomerOrderResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setError("Invalid table menu link")
      setLoading(false)
      return
    }

    void getCustomerTableMenu(token)
      .then(setMenu)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load menu"
        )
      })
      .finally(() => setLoading(false))
  }, [token])

  const visibleItems = useMemo(() => {
    if (!menu) return []
    if (categoryId === "all") return menu.items

    return menu.items.filter((item) => item.category._id === categoryId)
  }, [menu, categoryId])

  const cartItems = Object.values(cart)

  const total = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  )

  const changeQuantity = (item: PublicMenuItem, amount: number) => {
    setCart((current) => {
      const existing = current[item._id]
      const quantity = (existing?.quantity || 0) + amount

      if (quantity <= 0) {
        const updated = { ...current }
        delete updated[item._id]
        return updated
      }

      return {
        ...current,
        [item._id]: {
          item,
          quantity,
          notes: existing?.notes || "",
        },
      }
    })
  }

  const updateNotes = (itemId: string, notes: string) => {
    setCart((current) => {
      const existing = current[itemId]

      if (!existing) return current

      return {
        ...current,
        [itemId]: {
          ...existing,
          notes,
        },
      }
    })
  }

  const submitOrder = async () => {
    if (!token || cartItems.length === 0) return

    setSubmitting(true)
    setError("")

    try {
      const response = await submitCustomerOrder({
        token,
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
        })),
      })

      setResult(response)
      setCart({})
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="p-6 text-center text-muted-foreground">
        Loading menu...
      </main>
    )
  }

  if (error && !menu) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!menu) return null

  if (result) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Selection sent</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 text-center">
            <p>
              Your order request has been sent to the waiter for{" "}
              <strong>{result.order.tableName}</strong>.
            </p>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Order number</p>
              <p className="text-xl font-semibold">
                {result.order.orderNumber}
              </p>
            </div>

            <p className="font-semibold">{formatPrice(result.order.total)}</p>

            <p className="text-sm text-muted-foreground">
              Please wait for the waiter to review your selection and arrange
              payment.
            </p>

            <Button variant="outline" onClick={() => setResult(null)}>
              Start another order
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-muted/40 pb-96">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl p-4">
          <h1 className="text-xl font-semibold">Restaurant Menu</h1>
          <p className="text-sm text-muted-foreground">
            Ordering for {menu.table.name}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={categoryId === "all" ? "default" : "outline"}
            onClick={() => setCategoryId("all")}
          >
            All
          </Button>

          {menu.categories.map((category) => (
            <Button
              key={category._id}
              className="shrink-0"
              variant={categoryId === category._id ? "default" : "outline"}
              onClick={() => setCategoryId(category._id)}
            >
              {category.name}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => {
            const quantity = cart[item._id]?.quantity || 0

            return (
              <Card key={item._id}>
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-44 w-full rounded-t-xl object-cover"
                  />
                )}

                <CardHeader>
                  <div className="flex justify-between gap-3">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant="secondary">{formatPrice(item.price)}</Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="mb-4 min-h-10 text-sm text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={quantity === 0}
                      onClick={() => changeQuantity(item, -1)}
                    >
                      -
                    </Button>

                    <span className="font-semibold">{quantity}</span>

                    <Button size="sm" onClick={() => changeQuantity(item, 1)}>
                      +
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto border-t bg-background shadow-2xl">
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your selection</h2>
              <span className="font-semibold">{formatPrice(total)}</span>
            </div>

            {cartItems.map((cartItem) => (
              <div key={cartItem.item._id} className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    {cartItem.quantity} × {cartItem.item.name}
                  </span>
                  <span>
                    {formatPrice(cartItem.item.price * cartItem.quantity)}
                  </span>
                </div>

                <Textarea
                  className="min-h-14"
                  value={cartItem.notes}
                  placeholder="Special instructions"
                  onChange={(event) =>
                    updateNotes(cartItem.item._id, event.target.value)
                  }
                />

                <Separator />
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Name (optional)</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone (optional)</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              disabled={submitting}
              onClick={submitOrder}
            >
              {submitting ? "Sending..." : "Send selection to waiter"}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
