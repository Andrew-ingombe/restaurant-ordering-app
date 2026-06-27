import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ReceiptText,
  Settings2,
  Users,
  UtensilsCrossed,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

import type { AuthUser } from "../lib/api"

type OwnerNavKey =
  | "dashboard"
  | "orders"
  | "menu"
  | "staff"
  | "tables"
  | "settings"

type OwnerShellProps = {
  user: AuthUser
  onLogout: () => void
  active: OwnerNavKey
  headerContent: ReactNode
  headerActions?: ReactNode
  sidebarPanel?: ReactNode
  contentClassName?: string
  children: ReactNode
}

const navigationItems: Array<{
  key: OwnerNavKey
  label: string
  icon: typeof LayoutDashboard
  path: string
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/owner",
  },
  {
    key: "orders",
    label: "Orders",
    icon: ReceiptText,
    path: "/owner/orders",
  },
  {
    key: "menu",
    label: "Menu",
    icon: UtensilsCrossed,
    path: "/owner/menu",
  },
  {
    key: "staff",
    label: "Staff",
    icon: Users,
    path: "/owner/staff",
  },
  {
    key: "tables",
    label: "Tables & QR",
    icon: QrCode,
    path: "/owner/tables",
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings2,
    path: "/owner/settings",
  },
]

export function OwnerShell({
  user,
  onLogout,
  active,
  headerContent,
  headerActions,
  sidebarPanel,
  contentClassName,
  children,
}: OwnerShellProps) {
  const navigate = useNavigate()

  return (
    <main className="h-svh overflow-hidden bg-[#f5f5f6]">
      <div className="mx-auto flex h-full w-full max-w-[1800px] overflow-hidden bg-[#f5f5f6]">
        <aside className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-black/5 bg-white p-5 lg:flex">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#047857] text-white">
              <UtensilsCrossed className="size-5" />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">FOODLY</p>
              <p className="text-xs text-neutral-400">Restaurant admin</p>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = item.key === active

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-4 pt-6">
            {sidebarPanel}

            <div className="rounded-2xl bg-neutral-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.name}</p>

                  <p className="text-xs text-neutral-400 capitalize">
                    {user.role} account
                  </p>
                </div>
              </div>

              <Button
                className="mt-4 h-12 w-full cursor-pointer rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>

              <Button
                className="mt-3 h-12 w-full cursor-pointer rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-30 shrink-0 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{headerContent}</div>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      className="size-11 shrink-0 rounded-xl lg:hidden"
                      size="icon"
                      variant="outline"
                      aria-label="Open navigation"
                    >
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="right"
                    className="flex h-full w-[88vw] max-w-sm flex-col overflow-y-auto border-0 bg-white p-0"
                  >
                    <div className="flex min-h-full flex-col p-5">
                      <SheetHeader className="text-left">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-xl bg-[#047857] text-white">
                            <UtensilsCrossed className="size-5" />
                          </div>

                          <div>
                            <SheetTitle className="text-lg font-black tracking-tight">
                              FOODLY
                            </SheetTitle>

                            <SheetDescription className="text-xs text-neutral-400">
                              Restaurant admin
                            </SheetDescription>
                          </div>
                        </div>
                      </SheetHeader>

                      <nav className="mt-8 space-y-2">
                        {navigationItems.map((item) => {
                          const Icon = item.icon
                          const isActive = item.key === active

                          return (
                            <SheetClose key={item.key} asChild>
                              <button
                                type="button"
                                onClick={() => navigate(item.path)}
                                className={`flex h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                                  isActive
                                    ? "bg-neutral-950 text-white hover:bg-neutral-800"
                                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                                }`}
                              >
                                <Icon className="size-4" />
                                {item.label}
                              </button>
                            </SheetClose>
                          )
                        })}
                      </nav>

                      <div className="mt-auto space-y-4 pt-8">
                        {sidebarPanel}

                        <div className="rounded-2xl bg-neutral-100 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                              {user.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {user.name}
                              </p>

                              <p className="text-xs text-neutral-400 capitalize">
                                {user.role} account
                              </p>
                            </div>
                          </div>

                          <SheetClose asChild>
                            <Button
                              className="mt-4 h-12 w-full cursor-pointer rounded-xl"
                              variant="outline"
                              onClick={() => navigate("/account/password")}
                            >
                              <KeyRound className="size-4" />
                              Change password
                            </Button>
                          </SheetClose>

                          <SheetClose asChild>
                            <Button
                              className="mt-3 h-12 w-full cursor-pointer rounded-xl"
                              variant="outline"
                              onClick={onLogout}
                            >
                              <LogOut className="size-4" />
                              Sign out
                            </Button>
                          </SheetClose>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {headerActions && (
                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0">
                  {headerActions}
                </div>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className={`min-w-0 p-4 md:p-7 ${contentClassName || ""}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
