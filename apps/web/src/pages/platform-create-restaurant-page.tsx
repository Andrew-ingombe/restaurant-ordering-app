import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import { createPlatformRestaurant } from "../lib/api"
import type { AuthUser } from "../lib/api"

type PlatformCreateRestaurantPageProps = {
  user: AuthUser
  onLogout: () => void
}

type SubscriptionPlan = "pilot" | "starter" | "growth"

const emptyRestaurantForm = {
  name: "",
  currency: "ZMW",
  timezone: "Africa/Lusaka",
  phone: "",
  email: "",
  address: "",
  receiptFooter: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerPassword: "",
  plan: "pilot" as SubscriptionPlan,
  trialDays: "30",
}

export function PlatformCreateRestaurantPage({
  user,
  onLogout,
}: PlatformCreateRestaurantPageProps) {
  const navigate = useNavigate()

  const [restaurantForm, setRestaurantForm] = useState(emptyRestaurantForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleCreateRestaurant = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    setError("")
    setMessage("")

    try {
      const trialDays = Number(restaurantForm.trialDays)

      if (!Number.isInteger(trialDays) || trialDays < 0) {
        throw new Error("Trial days must be zero or greater")
      }

      const result = await createPlatformRestaurant({
        restaurant: {
          name: restaurantForm.name.trim(),
          currency: restaurantForm.currency.trim().toUpperCase(),
          timezone: restaurantForm.timezone.trim(),
          phone: restaurantForm.phone.trim(),
          email: restaurantForm.email.trim(),
          address: restaurantForm.address.trim(),
          receiptFooter: restaurantForm.receiptFooter.trim(),
        },
        owner: {
          name: restaurantForm.ownerName.trim(),
          email: restaurantForm.ownerEmail.trim(),
          phone: restaurantForm.ownerPhone.trim(),
          password: restaurantForm.ownerPassword,
        },
        subscription: {
          plan: restaurantForm.plan,
          trialDays,
        },
      })

      setMessage(`Created ${result.restaurant.name}`)
      setRestaurantForm(emptyRestaurantForm)

      window.setTimeout(() => {
        navigate("/platform")
      }, 800)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create restaurant"
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#f5f5f6]">
      <header className="border-b border-black/5 bg-white/90 px-4 py-4 backdrop-blur md:px-7">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              className="size-11 rounded-xl"
              size="icon"
              variant="outline"
              onClick={() => navigate("/platform")}
            >
              <ArrowLeft className="size-4" />
            </Button>

            <div className="flex size-11 items-center justify-center rounded-xl bg-[#047857] text-white">
              <ShieldCheck className="size-5" />
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#047857] uppercase">
                Platform admin
              </p>
              <h1 className="text-2xl font-black tracking-tight">
                Create restaurant
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{user.name}</p>
              <p className="text-xs text-neutral-400">{user.email}</p>
            </div>

            <Button className="rounded-xl" variant="outline" onClick={onLogout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-5 p-4 md:p-7">
        {error && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <form
          className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"
          onSubmit={handleCreateRestaurant}
        >
          <section className="rounded-[24px] bg-white p-5 md:p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-[#047857] text-white">
                <Building2 className="size-5" />
              </div>

              <div>
                <h2 className="text-xl font-black">Restaurant details</h2>
                <p className="text-sm text-neutral-400">
                  Basic information, settings, and trial period.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="restaurant-name">Restaurant name</Label>
                <Input
                  id="restaurant-name"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.name}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.currency}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                  required
                  maxLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trial-days">Trial days</Label>
                <Input
                  id="trial-days"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  type="number"
                  min={0}
                  value={restaurantForm.trialDays}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      trialDays: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.timezone}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={restaurantForm.plan}
                  onValueChange={(value) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      plan: value as SubscriptionPlan,
                    }))
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pilot">Pilot</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="restaurant-email">Restaurant email</Label>
                <Input
                  id="restaurant-email"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  type="email"
                  value={restaurantForm.email}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="restaurant-phone">Restaurant phone</Label>
                <Input
                  id="restaurant-phone"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.phone}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.address}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="receipt-footer">Receipt footer</Label>
                <Input
                  id="receipt-footer"
                  className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                  value={restaurantForm.receiptFooter}
                  onChange={(event) =>
                    setRestaurantForm((current) => ({
                      ...current,
                      receiptFooter: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[24px] bg-white p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-neutral-950 text-white">
                  <UserRound className="size-5" />
                </div>

                <div>
                  <h2 className="text-xl font-black">Owner account</h2>
                  <p className="text-sm text-neutral-400">
                    This user will manage the restaurant.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Owner name</Label>
                  <Input
                    id="owner-name"
                    className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                    value={restaurantForm.ownerName}
                    onChange={(event) =>
                      setRestaurantForm((current) => ({
                        ...current,
                        ownerName: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-email">Owner email</Label>
                  <Input
                    id="owner-email"
                    className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                    type="email"
                    value={restaurantForm.ownerEmail}
                    onChange={(event) =>
                      setRestaurantForm((current) => ({
                        ...current,
                        ownerEmail: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-phone">Owner phone</Label>
                  <Input
                    id="owner-phone"
                    className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                    value={restaurantForm.ownerPhone}
                    onChange={(event) =>
                      setRestaurantForm((current) => ({
                        ...current,
                        ownerPhone: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-password">
                    Owner temporary password
                  </Label>
                  <Input
                    id="owner-password"
                    className="h-12 rounded-xl border-0 bg-neutral-100 shadow-none"
                    type="password"
                    value={restaurantForm.ownerPassword}
                    onChange={(event) =>
                      setRestaurantForm((current) => ({
                        ...current,
                        ownerPassword: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-neutral-950 p-5 text-white md:p-6">
              <CheckCircle2 className="size-6 text-emerald-400" />

              <h2 className="mt-5 text-xl font-black">Before you create</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                This will create the restaurant workspace and first owner. Lenco
                payment credentials can be added afterward from the platform
                dashboard.
              </p>

              <Button
                className="mt-6 h-12 w-full rounded-xl bg-[#047857] text-white hover:bg-[#065F46]"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Create restaurant
                  </>
                )}
              </Button>

              <Button
                type="button"
                className="mt-3 h-12 w-full rounded-xl border-white/15 text-black hover:bg-white/10 hover:text-white"
                variant="outline"
                onClick={() => navigate("/platform")}
              >
                Cancel
              </Button>
            </div>
          </section>
        </form>
      </div>
    </main>
  )
}
