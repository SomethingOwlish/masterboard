// Stable, collision-resistant ids without a dependency. crypto.randomUUID is
// available in every browser we target; the fallback keeps tests/SSR happy.

export function newId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${uuid}` : uuid
}
