import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  QrCode,
  ReceiptText,
  Settings2,
  Users,
  UtensilsCrossed,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"

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
    <main className="min-h-svh">
      <div className="mx-auto flex min-h-[calc(100svh-24px)] max-w-[1600px] overflow-hidden rounded-[28px] bg-[#f5f5f6] md:min-h-[calc(100svh-40px)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-black/5 bg-white p-5 lg:flex">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#ef1428] text-white">
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
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
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

          <div className="mt-auto space-y-4">
            {sidebarPanel}

            <div className="rounded-2xl bg-neutral-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-neutral-950 text-white">
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
                className="mt-4 w-full rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>

              <Button
                className="mt-3 w-full rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">{headerContent}</div>

              <div className="flex items-center gap-2">
                {headerActions}

                <Button
                  className="size-11 rounded-xl lg:hidden"
                  size="icon"
                  variant="outline"
                  aria-label="Sign out"
                  onClick={onLogout}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = item.key === active

                return (
                  <Button
                    key={item.key}
                    className="shrink-0 rounded-xl"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                )
              })}

              <Button
                className="shrink-0 rounded-xl"
                variant="outline"
                onClick={() => navigate("/account/password")}
              >
                <KeyRound className="size-4" />
                Change password
              </Button>

              <Button
                className="shrink-0 rounded-xl"
                variant="outline"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </header>

          <div className={`p-4 md:p-7 ${contentClassName || ""}`}>
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}
