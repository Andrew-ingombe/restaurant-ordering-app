import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  BellRing,
  ClipboardList,
  KeyRound,
  LogOut,
  Menu,
  Plus,
  UtensilsCrossed,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import type { AuthUser, DraftOrder } from "../lib/api"
import { getCustomerOrderRequestCount } from "../lib/api"
import { getSocket } from "../lib/socket"

type WaiterShellActive = "new-order" | "orders" | "requests"

type WaiterShellProps = {
  user: AuthUser
  onLogout: () => void
  active: WaiterShellActive
  title: string
  eyebrow?: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
  contentScrollable?: boolean
}

const navigationItems: {
  label: string
  path: string
  active: WaiterShellActive
  icon: typeof Plus
}[] = [
  {
    label: "New order",
    path: "/waiter",
    active: "new-order",
    icon: Plus,
  },
  {
    label: "My orders",
    path: "/waiter/orders",
    active: "orders",
    icon: ClipboardList,
  },
  {
    label: "QR requests",
    path: "/waiter/requests",
    active: "requests",
    icon: BellRing,
  },
]

const formatQrCount = (count: number) => (count > 9 ? "9+" : String(count))

export function WaiterShell({
  user,
  onLogout,
  active,
  title,
  eyebrow = "Waiter workspace",
  description,
  icon,
  actions,
  children,
  contentClassName = "space-y-5",
  contentScrollable = true,
}: WaiterShellProps) {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [qrRequestCount, setQrRequestCount] = useState(0)
  const [qrCountPulse, setQrCountPulse] = useState(false)

  const loadQrRequestCount = async () => {
    try {
      setQrRequestCount(await getCustomerOrderRequestCount())
    } catch {
      setQrRequestCount(0)
    }
  }

  useEffect(() => {
    void loadQrRequestCount()
  }, [])

  useEffect(() => {
    const socket = getSocket()

    if (!socket) return

    const handleCustomerRequest = () => {
      setQrRequestCount((current) => current + 1)
      setQrCountPulse(true)
      window.setTimeout(() => setQrCountPulse(false), 1200)

      void loadQrRequestCount()
    }

    const handleCustomerClaimed = (order: DraftOrder) => {
      setQrRequestCount((current) => Math.max(0, current - 1))

      if (order) {
        void loadQrRequestCount()
      }
    }

    socket.on("order:customer-requested", handleCustomerRequest)
    socket.on("order:customer-claimed", handleCustomerClaimed)

    return () => {
      socket.off("order:customer-requested", handleCustomerRequest)
      socket.off("order:customer-claimed", handleCustomerClaimed)
    }
  }, [])

  const navigateFromMenu = (path: string) => {
    setMobileMenuOpen(false)
    navigate(path)
  }

  const handleLogout = () => {
    setMobileMenuOpen(false)
    onLogout()
  }

  const userInitial = user.name.trim().charAt(0).toUpperCase() || "W"

  const renderQrBadge = (isActive: boolean, mobile = false) => {
    if (qrRequestCount <= 0) return null

    return (
      <span
        className={`ml-auto flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${
          qrCountPulse ? "animate-pulse" : ""
        } ${
          mobile
            ? isActive
              ? "bg-white/20 text-white"
              : "bg-[#047857] text-white"
            : isActive
              ? "bg-white/20 text-white"
              : "bg-[#047857] text-white"
        }`}
      >
        {formatQrCount(qrRequestCount)}
      </span>
    )
  }

  return (
    <main className="h-svh overflow-hidden bg-[#f5f5f6]">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden">
        <header className="z-20 shrink-0 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#047857] text-white md:size-12">
                {icon || <UtensilsCrossed className="size-6" />}
              </div>

              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-[#047857] uppercase sm:text-xs sm:tracking-[0.2em]">
                  {eyebrow}
                </p>

                <h1 className="truncate text-xl font-black tracking-tight md:text-2xl">
                  {title}
                </h1>

                <p className="hidden truncate text-sm text-neutral-400 sm:block">
                  {description || `Signed in as ${user.name}`}
                </p>
              </div>
            </div>

            <div className="hidden flex-wrap gap-2 xl:flex">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = active === item.active
                const isQrRequests = item.active === "requests"

                return (
                  <Button
                    key={item.path}
                    className={`h-11 cursor-pointer rounded-xl ${
                      isActive
                        ? "bg-[#047857] text-white hover:bg-[#065F46]"
                        : ""
                    }`}
                    variant={isActive ? "default" : "outline"}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                    {isQrRequests && renderQrBadge(isActive)}
                  </Button>
                )
              })}

              <Button
                className="h-11 cursor-pointer rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>

              <Button
                className="h-11 cursor-pointer rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  className="size-11 shrink-0 cursor-pointer rounded-xl xl:hidden"
                  size="icon"
                  variant="outline"
                  aria-label="Open waiter navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="flex h-full w-[88vw] max-w-md flex-col border-0 bg-white p-0"
              >
                <SheetHeader className="border-b border-neutral-100 px-6 py-6 text-left">
                  <div className="flex items-center gap-4 pr-10">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#047857] text-white">
                      <UtensilsCrossed className="size-7" />
                    </div>

                    <div className="min-w-0">
                      <SheetTitle className="truncate text-2xl font-black">
                        Waiter workspace
                      </SheetTitle>

                      <SheetDescription className="mt-1 truncate text-sm text-neutral-400">
                        Restaurant ordering
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <nav className="flex-1 space-y-2 overflow-y-auto px-5 py-6">
                  {navigationItems.map((item) => {
                    const Icon = item.icon
                    const isActive = active === item.active
                    const isQrRequests = item.active === "requests"

                    return (
                      <Button
                        key={item.path}
                        className={`h-14 w-full cursor-pointer justify-start rounded-2xl px-5 text-base font-bold ${
                          isActive
                            ? "bg-neutral-950 text-white hover:bg-neutral-800 hover:text-white"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                        }`}
                        variant="ghost"
                        onClick={() => navigateFromMenu(item.path)}
                      >
                        <Icon className="mr-2 size-5" />
                        {item.label}
                        {isQrRequests && renderQrBadge(isActive, true)}
                      </Button>
                    )
                  })}
                </nav>

                <div className="border-t border-neutral-100 p-5">
                  <div className="rounded-[24px] bg-neutral-100 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-lg font-black text-white">
                        {userInitial}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black">{user.name}</p>
                        <p className="truncate text-sm text-neutral-400">
                          Waiter account
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Button
                        className="h-12 w-full cursor-pointer justify-center rounded-xl bg-white"
                        variant="outline"
                        onClick={() => navigateFromMenu("/account/password")}
                      >
                        <KeyRound className="size-4" />
                        Change password
                      </Button>

                      <Button
                        className="h-12 w-full cursor-pointer justify-center rounded-xl bg-white"
                        variant="outline"
                        onClick={handleLogout}
                      >
                        <LogOut className="size-4" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {actions && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
              {actions}
            </div>
          )}
        </header>

        <div
          className={`min-h-0 flex-1 p-4 md:p-6 ${
            contentScrollable
              ? "overflow-y-auto overscroll-contain"
              : "overflow-hidden"
          } ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </main>
  )
}
