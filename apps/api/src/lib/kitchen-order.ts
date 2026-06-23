export type PreparationArea = "kitchen" | "bar" | "none"

export const normalizePreparationArea = (value: unknown): PreparationArea => {
  if (value === "bar" || value === "none" || value === "kitchen") {
    return value
  }

  return "kitchen"
}

export const shouldSendItemToKitchen = (value: unknown) => {
  return normalizePreparationArea(value) === "kitchen"
}

export const filterKitchenItems = <T>(items: T[]) => {
  return items.filter((item) =>
    shouldSendItemToKitchen(
      (item as { preparationArea?: string | null }).preparationArea
    )
  )
}

export const hasKitchenItems = (items: unknown[]) => {
  return filterKitchenItems(items).length > 0
}

export const createKitchenOrderPayload = (order: {
  toObject: () => unknown
}) => {
  const payload = order.toObject() as Record<string, unknown> & {
    items?: unknown[]
  }

  return {
    ...payload,
    items: filterKitchenItems(payload.items || []),
  }
}
