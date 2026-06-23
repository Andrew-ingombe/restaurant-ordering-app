import { useEffect, useState } from "react"
import { ServerCrash, WifiOff } from "lucide-react"

type ApiAvailabilityDetail = {
  available: boolean
  message?: string
}

export function NetworkStatusBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [apiMessage, setApiMessage] = useState("")

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false)
      setApiMessage("")
    }

    const handleOffline = () => {
      setOffline(true)
    }

    const handleApiAvailability = (event: Event) => {
      const customEvent = event as CustomEvent<ApiAvailabilityDetail>

      if (customEvent.detail.available) {
        setApiMessage("")
        return
      }

      setApiMessage(
        customEvent.detail.message ||
          "The restaurant service is temporarily unavailable."
      )
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("api:availability", handleApiAvailability)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("api:availability", handleApiAvailability)
    }
  }, [])

  if (!offline && !apiMessage) {
    return null
  }

  const message = offline
    ? "You are offline. Check your internet connection before continuing."
    : apiMessage

  const Icon = offline ? WifiOff : ServerCrash

  return (
    <div
      className="fixed inset-x-0 top-3 z-[200] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Icon className="size-4" />
        </span>

        <div>
          <p className="text-sm font-bold">
            {offline ? "No internet connection" : "Service unavailable"}
          </p>

          <p className="mt-0.5 text-xs leading-5 text-amber-800">{message}</p>
        </div>
      </div>
    </div>
  )
}
