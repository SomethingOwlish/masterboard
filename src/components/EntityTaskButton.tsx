// "Create task ↗" affordance surfaced on any entity drawer (M10 / B8). Creates a
// local task titled after the entity and linked back to it; the GM can then push
// it to the third site from the Tasks board. Kept lightweight so it can drop into
// every drawer without pulling in the whole tracker UI.

import { useState } from 'react'
import { makeTask } from '../model/defaults'
import type { EntityKind } from '../store/entities'
import { useTasks } from '../store/tasks'

export function EntityTaskButton({
  campaignId,
  entityId,
  entityName,
  kind,
}: {
  campaignId?: string
  entityId: string
  entityName: string
  kind: EntityKind
}) {
  const load = useTasks((s) => s.load)
  const add = useTasks((s) => s.add)
  const [done, setDone] = useState(false)

  async function create() {
    if (!campaignId) return
    await load(campaignId) // no-op if already loaded for this campaign
    await add(makeTask(entityName || 'Task', [{ toId: entityId, kind }]))
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }

  return (
    <button onClick={() => void create()} disabled={done}>
      {done ? 'Task added ✓' : '✅ Create task'}
    </button>
  )
}
