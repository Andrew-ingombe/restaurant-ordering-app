import { useEffect, useMemo, useState } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"

import { createDraftOrder, getPublicMenu } from "../lib/api"
import type { AuthUser, MenuCategory, PublicMenuItem } from "../lib/api"

type CartItem = {
  item: PublicMenuItem
  quantity: number
  notes: string
}

type WaiterPageProps = {
  user: AuthUser
  onLogout: () => void
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
  }).format(price / 100)

export function WaiterPage({ user, onLogout }: WaiterPageProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<PublicMenuItem[]>([])
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in")
  const [tableName, setTableName] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    void getPublicMenu()
      .then((menu) => {
        setCategories(menu.categories)
        setItems(menu.items)
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load menu"
        )
      })
  }, [])

  const visibleItems = useMemo(() => {
    if (selectedCategory === "all") return items

    return items.filter((item) => item.category._id === selectedCategory)
  }, [items, selectedCategory])

  const cartItems = Object.values(cart)

  const total = cartItems.reduce(
    (sum, cartItem) => sum + cartItem.item.price * cartItem.quantity,
    0
  )

  const changeQuantity = (item: PublicMenuItem, amount: number) => {
    setSuccess("")

    setCart((current) => {
      const currentItem = current[item._id]
      const quantity = (currentItem?.quantity || 0) + amount

      if (quantity <= 0) {
        const next = { ...current }
        delete next[item._id]
        return next
      }

      return {
        ...current,
        [item._id]: {
          item,
          quantity,
          notes: currentItem?.notes || "",
        },
      }
    })
  }

  const updateNotes = (id: string, notes: string) => {
    setCart((current) => ({
      ...current,
      [id]: {
        ...current[id],
        notes,
      },
    }))
  }

  const submitOrder = async () => {
    setError("")
    setSuccess("")

    if (cartItems.length === 0) {
      setError("Add at least one menu item")
      return
    }

    if (orderType === "dine_in" && !tableName.trim()) {
      setError("Enter the table name or number")
      return
    }

    setSubmitting(true)

    try {
      const order = await createDraftOrder({
        orderType,
        tableName: orderType === "dine_in" ? tableName : "",
        customer: {
          name: customerName,
          phone: customerPhone,
        },
        items: cartItems.map((cartItem) => ({
          menuItem: cartItem.item._id,
          quantity: cartItem.quantity,
          notes: cartItem.notes,
        })),
      })

      setSuccess(`Draft ${order.orderNumber} created`)
      setCart({})
      setTableName("")
      setCustomerName("")
      setCustomerPhone("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create order"
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-semibold">New Order</h1>
            <p className="text-sm text-muted-foreground">Waiter: {user.name}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = "/waiter/orders"
              }}
            >
              My orders
            </Button>

            <Button variant="outline" onClick={onLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Button>

            {categories.map((category) => (
              <Button
                key={category._id}
                variant={
                  selectedCategory === category._id ? "default" : "outline"
                }
                onClick={() => setSelectedCategory(category._id)}
              >
                {category.name}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const quantity = cart[item._id]?.quantity || 0

              return (
                <Card key={item._id}>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-40 w-full rounded-t-xl object-cover"
                    />
                  )}

                  <CardHeader>
                    <div className="flex justify-between gap-3">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <Badge variant="secondary">
                        {formatPrice(item.price)}
                      </Badge>
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
                        onClick={() => changeQuantity(item, -1)}
                        disabled={quantity === 0}
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
        </section>

        <aside>
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Order type</Label>
                <Select
                  value={orderType}
                  onValueChange={(value) =>
                    setOrderType(value as "dine_in" | "takeaway")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine_in">Dine in</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {orderType === "dine_in" && (
                <div className="space-y-2">
                  <Label htmlFor="table">Table</Label>
                  <Input
                    id="table"
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder="Table 4"
                  />
                </div>
              )}

              {cartItems.map((cartItem) => (
                <div
                  key={cartItem.item._id}
                  className="space-y-2 border-b pb-4"
                >
                  <div className="flex justify-between gap-3">
                    <span>
                      {cartItem.quantity} × {cartItem.item.name}
                    </span>
                    <span>
                      {formatPrice(cartItem.item.price * cartItem.quantity)}
                    </span>
                  </div>

                  <Textarea
                    value={cartItem.notes}
                    onChange={(event) =>
                      updateNotes(cartItem.item._id, event.target.value)
                    }
                    placeholder="Kitchen notes"
                    className="min-h-16"
                  />
                </div>
              ))}

              {cartItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items selected.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer name</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">Customer phone</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {success && <p className="text-sm text-green-600">{success}</p>}

              <Button
                className="w-full"
                disabled={submitting || cartItems.length === 0}
                onClick={submitOrder}
              >
                {submitting ? "Saving..." : "Save draft order"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
