import { useState, useEffect } from "react"
import type { FormEvent } from "react"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { login } from "./lib/api"
import type { AuthUser, UserRole } from "./lib/api"
import { OwnerPage } from "./pages/owner-page"
import { OwnerMenuPage } from "./pages/owner-menu-page"
import { OwnerMenuItemsPage } from "./pages/owner-menu-items-page"
import { WaiterPage } from "./pages/waiter-page"
import { WaiterOrderDetailPage } from "./pages/waiter-order-detail-page"
import { WaiterOrdersPage } from "./pages/waiter-orders-page"
import { KitchenPage } from "./pages/kitchen-page"
import { disconnectSocket } from "./lib/socket"
import { OwnerDashboardPage } from "./pages/owner-dashboard-page"
import { OwnerTablesPage } from "./pages/owner-tables-page"
import { CustomerMenuPage } from "./pages/customer-menu-page"
import { WaiterRequestsPage } from "./pages/waiter-requests-page"
import { WaiterEditOrderPage } from "./pages/waiter-edit-order-page"
import { getCurrentUser } from "./lib/api"
import { ChangePasswordPage } from "./pages/change-password-page"
import { OwnerOrdersPage } from "./pages/owner-orders-page"
import { OwnerOrderDetailPage } from "./pages/owner-order-detail-page"
import { PlatformPage } from "./pages/platform-page"
import { PlatformCreateRestaurantPage } from "./pages/platform-create-restaurant-page"
import { OwnerSettingsPage } from "./pages/owner-settings-page"
import { Toaster } from "@workspace/ui/components/sonner"
import { AppLoadingSkeleton } from "./components/page-skeletons"
import { NetworkStatusBanner } from "./components/network-status-banner"

import {
  ArrowRight,
  ChefHat,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UtensilsCrossed,
  CheckCircle2,
  CircleX,
  Info,
  TriangleAlert,
} from "lucide-react"

const getStoredUser = (): AuthUser | null => {
  const storedUser = localStorage.getItem("auth_user")

  if (!storedUser) return null

  try {
    return JSON.parse(storedUser)
  } catch {
    localStorage.removeItem("auth_user")
    localStorage.removeItem("auth_token")
    return null
  }
}

const rolePath = (role: UserRole) =>
  role === "platform_admin" ? "/platform" : `/${role}`

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await login(email, password)

      localStorage.setItem("auth_token", result.token)
      localStorage.setItem("auth_user", JSON.stringify(result.user))

      onLogin(result.user)
      navigate(
        result.user.mustChangePassword
          ? "/account/password"
          : rolePath(result.user.role),
        { replace: true }
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to log in"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-svh overflow-hidden bg-[#ef1428] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -top-28 -right-28 size-80 rounded-full border-60 border-white/10" />
        <div className="absolute -bottom-36 -left-28 size-96 rounded-full border-70 border-white/10" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#ef1428]">
            <UtensilsCrossed className="size-6" />
          </div>

          <div>
            <p className="text-xl font-black tracking-tight">FOODLY</p>
            <p className="text-xs text-white/65">Restaurant ordering system</p>
          </div>
        </div>

        <div className="relative my-auto max-w-lg">
          <p className="text-xs font-semibold tracking-[0.25em] text-white/65 uppercase">
            One connected workspace
          </p>

          <h1 className="mt-5 text-5xl leading-[1.05] font-black tracking-tight">
            Orders flow better when everyone stays in sync.
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-white/75">
            Take orders, manage the kitchen, collect payments, and follow
            restaurant performance from one simple system.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <ChefHat className="size-5" />
              <p className="mt-3 text-sm font-bold">Kitchen</p>
              <p className="mt-1 text-xs text-white/60">Live preparation</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <UtensilsCrossed className="size-5" />
              <p className="mt-3 text-sm font-bold">Waiters</p>
              <p className="mt-1 text-xs text-white/60">Faster ordering</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="size-5" />
              <p className="mt-3 text-sm font-bold">Owners</p>
              <p className="mt-1 text-xs text-white/60">Clear oversight</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          Restaurant operations, thoughtfully connected.
        </p>
      </section>

      <section className="flex min-h-svh items-center justify-center bg-[#f7f7f8] p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#ef1428] text-white">
              <UtensilsCrossed className="size-5" />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">FOODLY</p>
              <p className="text-xs text-neutral-400">
                Restaurant ordering system
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#ef1428] uppercase">
              Welcome back
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">
              Sign in to your workspace
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Enter your staff account details to continue.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>

              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

                <Input
                  id="email"
                  className="h-13 rounded-xl border-0 bg-white pl-11 shadow-none ring-1 ring-neutral-200 transition focus-visible:ring-2 focus-visible:ring-[#ef1428]"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@restaurant.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400" />

                <Input
                  id="password"
                  className="h-13 rounded-xl border-0 bg-white pl-11 shadow-none ring-1 ring-neutral-200 transition focus-visible:ring-2 focus-visible:ring-[#ef1428]"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              className="h-13 w-full rounded-xl bg-[#ef1428] text-white hover:bg-[#d91023]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-100">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-4" />
            </div>

            <div>
              <p className="text-sm font-bold text-neutral-800">
                Secure staff access
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                Your account determines which restaurant workspace you can
                access.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function AppRoutes() {
  const location = useLocation()

  const isPublicCustomerMenu = location.pathname.startsWith("/menu/table/")
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)

  const [checkingSession, setCheckingSession] = useState(
    Boolean(localStorage.getItem("auth_token"))
  )

  const logout = () => {
    disconnectSocket()
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
  }

  const completeRequiredPasswordChange = () => {
    setUser((currentUser) => {
      if (!currentUser) return null

      const updatedUser = {
        ...currentUser,
        mustChangePassword: false,
      }

      localStorage.setItem("auth_user", JSON.stringify(updatedUser))

      return updatedUser
    })
  }

  useEffect(() => {
    const token = localStorage.getItem("auth_token")

    if (!token) {
      setCheckingSession(false)
      setUser(null)
      return
    }

    void getCurrentUser()
      .then((currentUser) => {
        localStorage.setItem("auth_user", JSON.stringify(currentUser))
        setUser(currentUser)
      })
      .catch(() => {
        logout()
      })
      .finally(() => {
        setCheckingSession(false)
      })
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
      setCheckingSession(false)
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized)

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized)
    }
  }, [])

  if (checkingSession && !isPublicCustomerMenu) {
    return <AppLoadingSkeleton />
  }

  if (
    user?.mustChangePassword &&
    !isPublicCustomerMenu &&
    location.pathname !== "/account/password"
  ) {
    return <Navigate to="/account/password" replace />
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={
                user.mustChangePassword
                  ? "/account/password"
                  : rolePath(user.role)
              }
              replace
            />
          ) : (
            <LoginPage onLogin={setUser} />
          )
        }
      />

      {(["owner", "waiter", "kitchen"] as UserRole[]).map((role) => (
        <Route
          key={role}
          path={`/${role}`}
          element={
            user?.role !== role ? (
              <Navigate to={user ? rolePath(user.role) : "/login"} replace />
            ) : role === "owner" ? (
              <OwnerDashboardPage user={user} onLogout={logout} />
            ) : role === "waiter" ? (
              <WaiterPage user={user} onLogout={logout} />
            ) : (
              <KitchenPage user={user} onLogout={logout} />
            )
          }
        />
      ))}

      <Route
        path="/owner/menu"
        element={
          user?.role === "owner" ? (
            <OwnerMenuPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/menu/items"
        element={
          user?.role === "owner" ? (
            <OwnerMenuItemsPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/orders"
        element={
          user?.role === "owner" ? (
            <OwnerOrdersPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/orders/:id"
        element={
          user?.role === "owner" ? (
            <OwnerOrderDetailPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/waiter/orders"
        element={
          user?.role === "waiter" ? (
            <WaiterOrdersPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/waiter/orders/:id"
        element={
          user?.role === "waiter" ? (
            <WaiterOrderDetailPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/staff"
        element={
          user?.role === "owner" ? (
            <OwnerPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/tables"
        element={
          user?.role === "owner" ? (
            <OwnerTablesPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/settings"
        element={
          user?.role === "owner" ? (
            <OwnerSettingsPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route path="/menu/table/:token" element={<CustomerMenuPage />} />

      <Route
        path="/waiter/requests"
        element={
          user?.role === "waiter" ? (
            <WaiterRequestsPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/waiter/orders/:id/edit"
        element={
          user?.role === "waiter" ? (
            <WaiterEditOrderPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/account/password"
        element={
          user ? (
            <ChangePasswordPage
              user={user}
              onPasswordChanged={completeRequiredPasswordChange}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/platform"
        element={
          user?.role === "platform_admin" ? (
            <PlatformPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/platform/restaurants/new"
        element={
          user?.role === "platform_admin" ? (
            <PlatformCreateRestaurantPage user={user} onLogout={logout} />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="*"
        element={
          <Navigate to={user ? rolePath(user.role) : "/login"} replace />
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NetworkStatusBanner />
      <AppRoutes />

      <Toaster
        theme="light"
        position="top-right"
        closeButton
        duration={4000}
        icons={{
          success: <CheckCircle2 className="size-5 text-emerald-700" />,
          error: <CircleX className="size-5 text-red-700" />,
          warning: <TriangleAlert className="size-5 text-amber-700" />,
          info: <Info className="size-5 text-blue-700" />,
          loading: (
            <RefreshCw className="size-5 animate-spin text-neutral-600" />
          ),
        }}
        toastOptions={{
          classNames: {
            toast: "!min-h-16 !w-full !rounded-xl !border !px-4 !py-3",
            content: "!gap-0.5",
            title: "!font-bold !text-neutral-950",
            description: "!text-sm !leading-5 !text-neutral-600",

            success: "!border-emerald-200 !bg-emerald-50",
            error: "!border-red-200 !bg-red-50",
            warning: "!border-amber-200 !bg-amber-50",
            info: "!border-blue-200 !bg-blue-50",

            closeButton:
              "!border-neutral-200 !bg-white !text-neutral-600 !shadow-sm hover:!bg-neutral-100",
          },
        }}
      />
    </BrowserRouter>
  )
}
