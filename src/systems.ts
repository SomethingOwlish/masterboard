// Game-system registry. A built-in list ships with the app; GMs can add their own
// systems, which persist in localStorage so they show up for every campaign on
// this device. Kept separate from campaign data so the option list is reusable.

export const BUILTIN_SYSTEMS = ['KK9', 'ScandiModerAu', 'SWADE', 'VTM 20', 'VTM 5', 'Coriolis'] as const

const KEY = 'mb.systems'

function loadCustom(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

/** Built-ins first, then custom systems, de-duplicated and order-stable. */
export function getSystems(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of [...BUILTIN_SYSTEMS, ...loadCustom()]) {
    const name = s.trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      out.push(name)
    }
  }
  return out
}

/** Add a custom system; returns the updated full list. No-op for blanks/dupes. */
export function addSystem(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return getSystems()
  const exists = getSystems().some((s) => s.toLowerCase() === trimmed.toLowerCase())
  if (!exists) {
    const custom = loadCustom()
    custom.push(trimmed)
    localStorage.setItem(KEY, JSON.stringify(custom))
  }
  return getSystems()
}
