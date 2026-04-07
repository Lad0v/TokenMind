const ISO_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

function normalizeDateInput(value: string | Date) {
  if (value instanceof Date) {
    return value
  }

  if (ISO_WITHOUT_ZONE.test(value)) {
    return new Date(`${value}Z`)
  }

  return new Date(value)
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
})

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
})

export function formatStableDate(value?: string | Date | null) {
  if (!value) {
    return "—"
  }

  return dateFormatter.format(normalizeDateInput(value))
}

export function formatStableDateTime(value?: string | Date | null) {
  if (!value) {
    return "—"
  }

  return dateTimeFormatter.format(normalizeDateInput(value))
}

export function formatStableMonth(value: Date) {
  return monthFormatter.format(value)
}

export function formatStableDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}
