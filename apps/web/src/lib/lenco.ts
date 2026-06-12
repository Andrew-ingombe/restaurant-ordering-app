type LencoCheckoutOptions = {
  key: string
  reference: string
  email: string
  amount: number
  currency: string
  channels: string[]
  customer: {
    firstName: string
    lastName: string
    phone: string
  }
  onSuccess: (response: { reference: string }) => void
  onClose: () => void
  onConfirmationPending: () => void
}

declare global {
  interface Window {
    LencoPay?: {
      getPaid: (options: LencoCheckoutOptions) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null

export const loadLencoScript = () => {
  if (window.LencoPay) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")

    script.src =
      import.meta.env.VITE_LENCO_SCRIPT_URL ||
      "https://pay.sandbox.lenco.co/js/v1/inline.js"
    script.async = true

    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Could not load Lenco checkout"))
    }

    document.body.appendChild(script)
  })

  return scriptPromise
}
