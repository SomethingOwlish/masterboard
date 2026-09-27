// КК9 на планировании сессии (М4): чистые функции и то, что переживает загрузку.
import { describe, expect, it } from 'vitest'
import { HttpExternalGateway } from './external'
import { kk9JournalPage, nextSessionText } from './kk9'
import { blankSession, normalizeCampaign } from './normalize'
import { completeReview } from './sessionFlow'
import type { LocalSessionPlanItem } from './types'

const NOW = '2026-09-27T00:00:00.000Z'
const item = (id: string, text: string, patch: Partial<LocalSessionPlanItem> = {}): LocalSessionPlanItem => ({ id, source: 'text', text, kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: '', origin: 'prepared', ...patch })

describe('КК9 · следующая игра строкой, как её пишет КК9', () => {
  it('день недели и число словами, время как вписано', () => {
    expect(nextSessionText('2026-10-11', '19:00')).toBe('воскресенье, 11 октября, 19:00')
    expect(nextSessionText('2026-10-10', '')).toBe('суббота, 10 октября')
    expect(nextSessionText('', 'после бала')).toBe('после бала')
  })
})

describe('КК9 · страница журнала из разбора', () => {
  it('итоги, сыгранные сцены, решения, раскрытия и новое — простым текстом', () => {
    const session = { ...blankSession(3, 'Сова', NOW, 's3'), title: 'Бал', reviewNotes: 'Мира сбежала.',
      planItems: [item('a', 'Вальс', { status: 'used' }), item('b', 'Дуэль'), item('c', 'Идея', { kind: 'idea', status: 'used' })],
      log: [{ id: 'l1', text: 'Декан отпустил', kind: 'decision' as const, createdAt: NOW }, { id: 'l2', text: 'Декан — вор', kind: 'reveal' as const, createdAt: NOW }, { id: 'l3', text: 'Бросок 12', kind: 'roll' as const, createdAt: NOW }] }
    expect(kk9JournalPage(session, (i) => i.text)).toEqual({
      title: 'Сессия №3 — Бал',
      body: 'Мира сбежала.\n\nСыграно:\n— Вальс\n\nРешения:\n— Декан отпустил\n\nРаскрыто:\n— Декан — вор',
    })
  })
})

describe('КК9 · дата следующей игры и отметка отправки', () => {
  it('переживают загрузку кампании, кривая дата отбрасывается', () => {
    const campaign = normalizeCampaign({ id: 'c', name: 'К', sessionRecords: [{ id: 's1', number: 1, nextGame: { date: '2026-02-30', time: '19:00' }, kk9Sent: { stream: 'gmPrivate', pageId: 'p', fingerprint: 7, sentAt: NOW } }] }, NOW)!
    const [session] = campaign.sessionRecords
    expect(session.nextGame).toEqual({ date: '', time: '19:00' })
    expect(session.kk9Sent).toEqual({ stream: 'gmPrivate', pageId: 'p', fingerprint: 7, sentAt: NOW })
  })
  it('дата из разбора ложится в следующую сессию, которую создаёт перенос', () => {
    const base = normalizeCampaign({ id: 'c', name: 'К' }, NOW)!
    const played = { ...blankSession(1, 'Сова', NOW, 's1'), status: 'completed' as const, planItems: [item('p1', 'Ворота')], reviewDecisions: { p1: 'carry' as const }, nextGame: { date: '2026-10-10', time: '19:00' } }
    const next = completeReview({ ...base, sessionRecords: [played] }, 's1', { target: 'new', now: NOW })
    expect(next.sessionRecords.find((s) => s.id !== 's1')?.date).toBe('2026-10-10')
  })
})

describe('КК9 · дверь', () => {
  it('состояние — GET state, итоги — POST session с ключом повтора = id сессии', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const port = new HttpExternalGateway((async (url: RequestInfo | URL, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response('{}', { headers: { 'content-type': 'application/json' } }) }) as typeof fetch)
    await port.kk9State('k 1')
    await port.sendKk9Session('k1', 's1', { journal: { stream: 'campaign', title: 'T', body: 'B' }, nextSession: 'пятница' })
    expect(calls[0].url).toBe('/api/ext/state?system=kk9&externalId=k%201')
    expect(calls[1].url).toBe('/api/ext/session')
    expect(JSON.parse(calls[1].init!.body as string)).toEqual({ system: 'kk9', externalId: 'k1', idempotencyKey: 's1', journal: { stream: 'campaign', title: 'T', body: 'B' }, nextSession: 'пятница' })
  })
})
