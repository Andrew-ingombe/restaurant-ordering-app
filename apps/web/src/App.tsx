import { useState } from "react"
import type { FormEvent } from "react"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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

const rolePath = (role: UserRole) => `/${role}`

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
      navigate(rolePath(result.user.role), { replace: true })
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
    <main className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Restaurant Ordering</CardTitle>
          <CardDescription>Sign in to access your workspace.</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function AppRoutes() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)

  const logout = () => {
    disconnectSocket()
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={rolePath(user.role)} replace />
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
              <OwnerPage user={user} onLogout={logout} />
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
            <OwnerMenuPage />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/owner/menu/items"
        element={
          user?.role === "owner" ? (
            <OwnerMenuItemsPage />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/waiter/orders"
        element={
          user?.role === "waiter" ? (
            <WaiterOrdersPage />
          ) : (
            <Navigate to={user ? rolePath(user.role) : "/login"} replace />
          )
        }
      />

      <Route
        path="/waiter/orders/:id"
        element={
          user?.role === "waiter" ? (
            <WaiterOrderDetailPage />
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
      <AppRoutes />
    </BrowserRouter>
  )
}
