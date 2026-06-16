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

let loadedScriptUrl = ""
let scriptPromise: Promise<void> | null = null

export const loadLencoScript = (scriptUrl: string) => {
  if (window.LencoPay && loadedScriptUrl === scriptUrl) {
    return Promise.resolve()
  }

  if (scriptPromise && loadedScriptUrl === scriptUrl) {
    return scriptPromise
  }

  document
    .querySelectorAll<HTMLScriptElement>("script[data-lenco-checkout='true']")
    .forEach((script) => script.remove())

  window.LencoPay = undefined
  loadedScriptUrl = scriptUrl

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")

    script.src = scriptUrl
    script.async = true
    script.dataset.lencoCheckout = "true"

    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      loadedScriptUrl = ""
      reject(new Error("Could not load Lenco checkout"))
    }

    document.body.appendChild(script)
  })

  return scriptPromise
}
