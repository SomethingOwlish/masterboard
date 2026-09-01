import type { DocumentData, DocumentSnapshot, StorageGateway } from './gateway'

export interface FieldEditConflict {
  field: string
  baselineValue: unknown
  localValue: unknown
  currentValue: unknown
}

export type FieldConflictChoice =
  | { choice: 'local' }
  | { choice: 'current' }
  | { choice: 'custom'; value: unknown }
  | { choice: 'defer' }

export type SaveEditResult<T extends DocumentData> =
  | { status: 'saved'; snapshot: DocumentSnapshot<T> }
  | {
      status: 'conflict'
      path: string
      currentRevision: number
      mergeablePatch: Partial<T>
      conflicts: FieldEditConflict[]
    }

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Deterministic equality for JSON-compatible field values. */
export function fieldValueEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => fieldValueEqual(value, right[index]))
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && fieldValueEqual(left[key], right[key]))
  }
  return false
}

/** Return only fields the editor actually changed from its loaded baseline. */
export function changedFields<T extends DocumentData>(baseline: T, edited: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(edited).filter(([field, value]) => !fieldValueEqual(baseline[field], value)),
  ) as Partial<T>
}

/**
 * Save an edit using the product rule from the specification:
 * - without a co-master, issue a direct patch without an extra read;
 * - with a co-master, compare only locally changed fields in one transaction;
 * - merge disjoint changes and surface same-field conflicts.
 */
export async function saveDocumentEdit<T extends DocumentData>(input: {
  storage: StorageGateway
  path: string
  baseline: DocumentSnapshot<T>
  edited: Partial<T>
  hasCoMaster: boolean
}): Promise<SaveEditResult<T>> {
  const localPatch = changedFields(input.baseline.data, input.edited)
  if (Object.keys(localPatch).length === 0) return { status: 'saved', snapshot: input.baseline }

  if (!input.hasCoMaster) {
    return { status: 'saved', snapshot: await input.storage.patch<T>(input.path, localPatch) }
  }

  const result = await input.storage.runTransaction<SaveEditResult<T>>(async (transaction) => {
    const current = await transaction.get<T>(input.path)
    if (!current) throw new Error(`Cannot save missing document ${input.path}`)

    const mergeablePatch: Partial<T> = {}
    const conflicts: FieldEditConflict[] = []
    for (const [field, localValue] of Object.entries(localPatch)) {
      const baselineValue = input.baseline.data[field]
      const currentValue = current.data[field]
      if (fieldValueEqual(currentValue, baselineValue) || fieldValueEqual(currentValue, localValue)) {
        if (!fieldValueEqual(currentValue, localValue)) {
          Object.assign(mergeablePatch, { [field]: localValue })
        }
      } else {
        conflicts.push({ field, baselineValue, localValue, currentValue })
      }
    }

    if (conflicts.length) {
      return {
        status: 'conflict', path: input.path, currentRevision: current.revision,
        mergeablePatch, conflicts,
      }
    }
    if (Object.keys(mergeablePatch).length) {
      transaction.patch<T>(input.path, mergeablePatch, { revision: current.revision })
    }
    return {
      status: 'saved',
      snapshot: {
        path: current.path,
        revision: current.revision + (Object.keys(mergeablePatch).length ? 1 : 0),
        data: { ...current.data, ...mergeablePatch },
      },
    }
  })
  return result
}

export function resolveFieldConflicts<T extends DocumentData>(
  conflict: Extract<SaveEditResult<T>, { status: 'conflict' }>,
  resolutions: Record<string, FieldConflictChoice>,
): Partial<T> {
  const patch: DocumentData = { ...conflict.mergeablePatch }
  for (const item of conflict.conflicts) {
    const resolution = resolutions[item.field]
    if (!resolution) throw new Error(`Resolution is required for field ${item.field}`)
    if (resolution.choice === 'local') patch[item.field] = item.localValue
    if (resolution.choice === 'current') patch[item.field] = item.currentValue
    if (resolution.choice === 'custom') patch[item.field] = resolution.value
    // Deferred fields are intentionally omitted, leaving the current value intact.
  }
  return patch as Partial<T>
}

export async function applyResolvedEdit<T extends DocumentData>(input: {
  storage: StorageGateway
  conflict: Extract<SaveEditResult<T>, { status: 'conflict' }>
  resolutions: Record<string, FieldConflictChoice>
}): Promise<DocumentSnapshot<T>> {
  const patch = resolveFieldConflicts(input.conflict, input.resolutions)
  if (Object.keys(patch).length === 0) {
    const current = await input.storage.get<T>(input.conflict.path)
    if (!current) throw new Error(`Cannot resolve missing document ${input.conflict.path}`)
    return current
  }
  return input.storage.patch<T>(input.conflict.path, patch, {
    revision: input.conflict.currentRevision,
  })
}
