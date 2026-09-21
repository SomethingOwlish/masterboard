import type { LocalCampaignRecord, LocalSessionLogEntry, LocalSessionScene } from '../fixtures/localCampaignCatalog'
import { validSceneLayout } from './localSessionBoard'

export type LocalSessionStatus = 'draft' | 'ready' | 'active' | 'completed'
export interface LocalSessionDocument {
  id: string
  seq: number
  title: string
  realDate: string
  objective: string
  opening: string
  status: LocalSessionStatus
  scenes: LocalSessionScene[]
  currentSceneId: string
  log: LocalSessionLogEntry[]
  recap: string
  completedAt?: string
  deletedAt?: string
}

export function validSessionDate(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function currentDocument(campaign: LocalCampaignRecord, id: string, seq: number): LocalSessionDocument {
  return { id, seq, title: campaign.firstSessionTitle, realDate: campaign.firstSessionDate ?? '',
    objective: campaign.firstSessionObjective, opening: campaign.firstSessionOpening,
    status: campaign.firstSessionStatus, scenes: structuredClone(campaign.firstSessionScenes),
    currentSceneId: campaign.firstSessionCurrentSceneId, log: structuredClone(campaign.firstSessionLog), recap: campaign.firstSessionRecap ?? '',
  }
}

/** Keep the old screen fields as a projection of one independently stored document.
 * Legacy IDs are deterministic: read/migration never duplicates a session. */
export function syncLocalSessions(campaign: LocalCampaignRecord): LocalCampaignRecord {
  let documents = structuredClone(campaign.sessionDocuments ?? [])
  let selectedId = campaign.selectedSessionId
  if (campaign.sessionDocuments === undefined) {
    documents = (campaign.sessionHistory ?? []).map((session) => ({ ...structuredClone(session), realDate: session.realDate ?? '', status: 'completed' as const, currentSceneId: '', recap: session.recap ?? '' }))
    if (campaign.firstSessionTitle) {
      selectedId = `${campaign.id}:legacy-current`
      documents.push(currentDocument(campaign, selectedId, Math.max(0, ...documents.map((session) => session.seq)) + 1))
    }
  } else if (selectedId) {
    const index = documents.findIndex((session) => session.id === selectedId && !session.deletedAt)
    if (index < 0) throw new Error('Выбранная сессия отсутствует')
    documents[index] = { ...documents[index], ...currentDocument(campaign, selectedId, documents[index].seq) }
  } else if (campaign.firstSessionTitle) {
    selectedId = `${campaign.id}:legacy-current`
    documents.push(currentDocument(campaign, selectedId, Math.max(0, ...documents.map((session) => session.seq)) + 1))
  }
  documents = documents.map((session) => session.status === 'completed' && !session.completedAt ? { ...session, completedAt: campaign.updatedAt } : session)
  return {
    ...campaign, sessionDocuments: documents, selectedSessionId: selectedId,
    nextSessionSeq: Math.max(campaign.nextSessionSeq ?? 1, ...documents.map((session) => session.seq + 1)),
    sessions: documents.filter((session) => !session.deletedAt).length,
    sessionHistory: documents.filter((session) => !session.deletedAt && session.status === 'completed' && session.id !== selectedId).map((session) => ({ id: session.id, seq: session.seq, title: session.title, objective: session.objective, opening: session.opening, scenes: session.scenes, log: session.log, completedAt: session.completedAt ?? '', realDate: session.realDate, recap: session.recap })),
  }
}

function project(campaign: LocalCampaignRecord, session?: LocalSessionDocument): LocalCampaignRecord {
  return syncLocalSessions({ ...campaign, selectedSessionId: session?.id,
    firstSessionTitle: session?.title ?? '', firstSessionDate: session?.realDate ?? '', firstSessionObjective: session?.objective ?? '',
    firstSessionOpening: session?.opening ?? '', firstSessionStatus: session?.status ?? 'draft',
    firstSessionScenes: structuredClone(session?.scenes ?? []), firstSessionCurrentSceneId: session?.currentSceneId ?? '',
    firstSessionLog: structuredClone(session?.log ?? []), firstSessionRecap: session?.recap ?? '',
  })
}

export function selectLocalSession(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const current = syncLocalSessions(campaign)
  const session = current.sessionDocuments!.find((item) => item.id === id && !item.deletedAt)
  if (!session) throw new Error('Сессия не найдена')
  return project(current, session)
}

export function createLocalSession(campaign: LocalCampaignRecord, title: string, realDate = ''): LocalCampaignRecord {
  if (!title.trim()) throw new Error('Введите название сессии')
  if (!validSessionDate(realDate)) throw new Error('Введите корректную дату сессии')
  const current = syncLocalSessions(campaign)
  const session: LocalSessionDocument = { id: `session-${crypto.randomUUID()}`, seq: current.nextSessionSeq!, title: title.trim(), realDate,
    objective: '', opening: '', status: 'draft', scenes: [], currentSceneId: '', log: [], recap: '' }
  return project({ ...current, sessionDocuments: [...current.sessionDocuments!, session], nextSessionSeq: session.seq + 1 }, session)
}

export function duplicateLocalSession(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const current = syncLocalSessions(campaign)
  const source = current.sessionDocuments!.find((session) => session.id === id && !session.deletedAt)
  if (!source) throw new Error('Сессия не найдена')
  const ids = new Map(source.scenes.map((scene) => [scene.id, `scene-${crypto.randomUUID()}`]))
  const session: LocalSessionDocument = { ...structuredClone(source), id: `session-${crypto.randomUUID()}`, seq: current.nextSessionSeq!,
    title: `${source.title} — копия`, realDate: '', status: 'draft', currentSceneId: '', log: [], recap: '', completedAt: undefined,
    scenes: source.scenes.map((scene) => ({ ...structuredClone(scene), id: ids.get(scene.id)!, nextSceneIds: scene.nextSceneIds?.map((next) => ids.get(next)).filter((next): next is string => !!next) })),
  }
  return project({ ...current, sessionDocuments: [...current.sessionDocuments!, session], nextSessionSeq: session.seq + 1 }, session)
}

export function deleteLocalSession(campaign: LocalCampaignRecord, id: string, now = new Date().toISOString()): LocalCampaignRecord {
  const current = syncLocalSessions(campaign)
  const target = current.sessionDocuments!.find((session) => session.id === id && !session.deletedAt)
  if (!target) throw new Error('Сессия не найдена')
  if (target.status === 'active') throw new Error('Сначала завершите идущую сессию')
  const documents = current.sessionDocuments!.map((session) => session.id === id ? { ...session, deletedAt: now } : session)
  const selected = documents.find((session) => session.id === current.selectedSessionId && !session.deletedAt) ?? documents.find((session) => !session.deletedAt && session.status === 'active') ?? documents.find((session) => !session.deletedAt)
  return project({ ...current, sessionDocuments: documents }, selected)
}

export function restoreLocalSession(campaign: LocalCampaignRecord, id: string): LocalCampaignRecord {
  const current = syncLocalSessions(campaign)
  const target = current.sessionDocuments!.find((session) => session.id === id && session.deletedAt)
  if (!target) throw new Error('Удалённая сессия не найдена')
  const restored = { ...target, deletedAt: undefined }
  return project({ ...current, sessionDocuments: current.sessionDocuments!.map((session) => session.id === id ? restored : session) }, restored)
}

export function startLocalSession(campaign: LocalCampaignRecord): LocalCampaignRecord {
  const current = syncLocalSessions(campaign)
  if (current.firstSessionStatus !== 'ready') throw new Error('Сначала отметьте сессию готовой')
  if (current.sessionDocuments!.some((session) => session.status === 'active' && !session.deletedAt && session.id !== current.selectedSessionId)) throw new Error('Другая сессия уже идёт. Завершите её перед запуском новой.')
  return syncLocalSessions({ ...current, firstSessionStatus: 'active', firstSessionCurrentSceneId: current.firstSessionCurrentSceneId || current.firstSessionScenes[0]?.id || '' })
}

export function selectedSessionNumber(campaign: LocalCampaignRecord): number {
  const current = syncLocalSessions(campaign)
  return current.sessionDocuments?.find((session) => session.id === current.selectedSessionId)?.seq ?? 1
}

export function validSessionDocuments(value: unknown): value is LocalSessionDocument[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>(); const seqs = new Set<number>()
  const strings = (row: unknown, keys: string[]) => !!row && typeof row === 'object' && keys.every((key) => typeof (row as Record<string, unknown>)[key] === 'string')
  return value.every((session: LocalSessionDocument) => {
    if (!strings(session, ['id', 'title', 'realDate', 'objective', 'opening', 'status', 'currentSceneId', 'recap']) || !session.id || !session.title.trim() || !Number.isSafeInteger(session.seq) || session.seq < 1 || ids.has(session.id) || seqs.has(session.seq) || !validSessionDate(session.realDate)) return false
    ids.add(session.id); seqs.add(session.seq)
    return ['draft', 'ready', 'active', 'completed'].includes(session.status) &&
      (session.completedAt === undefined || typeof session.completedAt === 'string') && (session.deletedAt === undefined || typeof session.deletedAt === 'string') &&
      Array.isArray(session.scenes) && session.scenes.every((scene) => strings(scene, ['id', 'title', 'purpose']) && validSceneLayout(scene) && (scene.memberIds === undefined || Array.isArray(scene.memberIds) && scene.memberIds.every((id) => typeof id === 'string'))) &&
      Array.isArray(session.log) && session.log.every((entry) => strings(entry, ['id', 'text', 'createdAt']))
  })
}

export function sessionPath(campaign: LocalCampaignRecord, section: string, id = campaign.selectedSessionId): string {
  const base = `/local/campaign/${encodeURIComponent(campaign.id)}/${section}`
  return id && ['session', 'play', 'print'].includes(section) ? `${base}/${encodeURIComponent(id)}` : base
}
