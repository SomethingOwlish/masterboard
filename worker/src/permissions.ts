/**
 * Server-side version of decision D2 (roles with restrictions). The client
 * checks the same rules for the UI; the Worker checks them so a modified
 * client cannot bypass them.
 */

export interface MasterLike { id: string; name?: string; email?: string; role: 'owner' | 'co-master' }
interface SessionLike { id: string; masterId: string; status: string; reviewStatus: string; deletedAt?: string }
export interface CampaignLike { masters?: MasterLike[]; archived?: boolean; sessionRecords?: SessionLike[] }

const norm = (email: string) => email.trim().toLocaleLowerCase()

export function memberOf(campaign: CampaignLike, email: string): MasterLike | undefined {
  return (campaign.masters ?? []).find((master) => master.email && norm(master.email) === norm(email))
}

export class PermissionError extends Error {
  constructor(message: string) { super(message); this.name = 'PermissionError' }
}

const sameMasters = (left: MasterLike[] = [], right: MasterLike[] = []) =>
  JSON.stringify(left.map(({ id, email, role }) => [id, email ? norm(email) : '', role])) === JSON.stringify(right.map(({ id, email, role }) => [id, email ? norm(email) : '', role]))

/** Throws when `email` may not replace `before` with `after` (`before` null = create). */
export function assertCanWrite(before: CampaignLike | null, after: CampaignLike, email: string): void {
  const nextMember = memberOf(after, email)
  if (!before) {
    if (nextMember?.role !== 'owner') throw new PermissionError('Создать общую кампанию может только её владелец (ваша почта должна быть у владельца)')
    return
  }
  const member = memberOf(before, email)
  if (!member) throw new PermissionError('Вы не мастер этой кампании')
  const isOwner = member.role === 'owner'
  if (!isOwner && (!sameMasters(before.masters, after.masters) || Boolean(before.archived) !== Boolean(after.archived))) {
    throw new PermissionError('Состав мастеров и архив меняет только владелец')
  }
  if (isOwner) return
  const previous = new Map((before.sessionRecords ?? []).map((session) => [session.id, session]))
  const kept = new Set((after.sessionRecords ?? []).map((session) => session.id))
  for (const old of before.sessionRecords ?? []) {
    if (!kept.has(old.id) && old.masterId !== member.id) throw new PermissionError('Удалить сессию может её ответственный мастер или владелец')
  }
  for (const session of after.sessionRecords ?? []) {
    const old = previous.get(session.id)
    if (!old) continue
    const runChanged = old.status !== session.status || old.reviewStatus !== session.reviewStatus
    const handedOver = old.masterId !== session.masterId
    const trashChanged = Boolean(old.deletedAt) !== Boolean(session.deletedAt)
    if ((runChanged || handedOver || trashChanged) && old.masterId !== member.id) {
      throw new PermissionError('Запускать, закрывать, разбирать, передавать и убирать в корзину сессию может её ответственный мастер или владелец')
    }
  }
}

export function assertCanDelete(before: CampaignLike, email: string): void {
  if (memberOf(before, email)?.role !== 'owner') throw new PermissionError('Удалить кампанию может только владелец')
}
