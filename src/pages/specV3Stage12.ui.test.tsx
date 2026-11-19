// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newArc, newClock, newSecret } from '../local/domain'
import { blankSession, normalizeCampaign } from '../local/normalize'
import { applyReviewDraft, completeReview } from '../local/sessionFlow'
import type { LocalCampaignRecord, LocalSessionRecord } from '../local/types'
import { readyCampaign, renderApp } from '../test/renderApp'

const NOW = '2026-11-18T08:00:00.000Z'
const closed = (patch: Partial<LocalSessionRecord> = {}): LocalSessionRecord => ({
  ...blankSession(3, 'Сова', NOW, 's3'), title: 'Шторм', status: 'completed', ...patch,
})
const world = () => ({
  clocks: [newClock({ id: 'tide', title: 'Прилив', value: 2, segments: 6 })],
  storyArcs: [newArc({ id: 'heir', title: 'Наследник', status: 'active', progress: 20 })],
  secrets: [newSecret({ id: 'mole', title: 'Крот в гильдии', status: 'hidden' })],
  activeTime: 'Ночь 3',
})

describe('ТЗ-3, этап 12: разбор с применением в конце', () => {
  it('keeps clocks, arcs, time and secrets untouched until «Завершить разбор»', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ ...world(), sessionRecords: [closed()], activeSessionId: 's3' })
    renderApp(`/local/campaign/${id}/review`, catalog)
    const wizard = await screen.findByLabelText('Разбор сессии')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))

    const clock = within(wizard).getByRole('article', { name: 'Часы: Прилив' })
    expect(within(clock).getByRole('button', { name: 'Продвинуть Прилив' })).toBeDisabled()
    await user.click(within(clock).getByRole('button', { name: 'Итоги сессии №3' }))
    await user.click(within(clock).getByRole('button', { name: 'Продвинуть Прилив' }))
    await user.click(within(clock).getByRole('button', { name: 'Продвинуть Прилив' }))
    expect(within(clock).getByText('2/6 → 4/6')).toBeInTheDocument()
    await user.selectOptions(within(wizard).getByLabelText('Состояние секрета: Крот в гильдии'), 'everyone')
    await user.click(within(wizard).getByRole('button', { name: 'Далее' }))
    const time = within(wizard).getByLabelText('Текущее время кампании после сессии')
    await user.clear(time)
    await user.type(time, 'Ночь 4')

    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].reviewDraft?.time).toBe('Ночь 4'))
    let saved = (await catalog.find(id))!
    expect(saved.sessionRecords[0].reviewDraft?.clocks.tide).toEqual({ delta: 2, reason: 'Итоги сессии №3' })
    expect(saved.clocks[0].value).toBe(2)
    expect(saved.secrets[0].status).toBe('hidden')
    expect(saved.activeTime).toBe('Ночь 3')

    // Leaving the review before the end changes nothing in the campaign.
    cleanup()
    renderApp(`/local/campaign/${id}/review`, catalog)
    const again = await screen.findByLabelText('Разбор сессии')
    for (let step = 0; step < 4; step += 1) await user.click(within(again).getByRole('button', { name: 'Далее' }))
    expect(within(again).getByText('Применится по «Завершить разбор»:')).toBeInTheDocument()
    await user.selectOptions(within(again).getByLabelText('Следующая сессия'), 'none')
    await user.click(within(again).getByRole('button', { name: 'Завершить разбор' }))

    await waitFor(async () => expect((await catalog.find(id))?.sessionRecords[0].reviewStatus).toBe('completed'))
    saved = (await catalog.find(id))!
    expect(saved.clocks[0]).toMatchObject({ value: 4 })
    expect(saved.clocks[0].history).toHaveLength(1)
    expect(saved.secrets[0]).toMatchObject({ status: 'everyone' })
    expect(saved.secrets[0].reveals[0]).toMatchObject({ sessionId: 's3', note: 'Разбор сессии №3' })
    expect(saved.activeTime).toBe('Ночь 4')
    expect(saved.sessionRecords[0].reviewDraft).toBeUndefined()
    expect(saved.sessionRecords[0].reviewApplied?.map((change) => change.kind)).toEqual(['clock', 'secret', 'time'])

    // «Открыть разбор заново» shows what is already applied.
    expect(await screen.findByText('Уже применено · 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Открыть разбор заново' }))
    const reopened = await screen.findByLabelText('Разбор сессии')
    await user.click(within(reopened).getByRole('button', { name: 'Далее' }))
    await user.click(within(reopened).getByRole('button', { name: 'Далее' }))
    expect(within(reopened).getByText('Уже применено · 3')).toBeInTheDocument()
    expect(within(within(reopened).getByRole('article', { name: 'Часы: Прилив' })).getByText('4/6')).toBeInTheDocument()
  })

  it('moves a live clock only with a reason, filled by a chip', async () => {
    const user = userEvent.setup()
    const active = { ...blankSession(1, 'Сова', NOW, 's1'), title: 'Игра', status: 'active' as const }
    const { catalog, id } = await readyCampaign({ ...world(), sessionRecords: [active], activeSessionId: 's1' })
    renderApp(`/local/campaign/${id}/play`, catalog)
    const panel = await screen.findByRole('complementary', { name: 'Живая панель' })
    await user.click(within(panel).getByRole('tab', { name: /^Часы/ }))
    const clock = within(panel).getByRole('article', { name: 'Часы: Прилив' })
    expect(within(clock).getByRole('button', { name: 'Продвинуть Прилив' })).toBeDisabled()
    await user.click(within(clock).getByRole('button', { name: 'Провал броска' }))
    expect(within(clock).getByLabelText('Причина: Прилив')).toHaveValue('Провал броска')
    await user.click(within(clock).getByRole('button', { name: 'Продвинуть Прилив' }))
    await waitFor(async () => expect((await catalog.find(id))?.clocks[0].history[0]?.reason).toBe('Провал броска'))
  })
})

describe('applyReviewDraft', () => {
  const campaign = (draft: LocalSessionRecord['reviewDraft']): LocalCampaignRecord => normalizeCampaign({
    id: 'c', name: 'К', ...world(), sessionRecords: [closed({ reviewDraft: draft })],
  }, NOW)!

  it('applies the net clock move once and skips values equal to the current ones', () => {
    const base = campaign({ clocks: { tide: { delta: -1, reason: 'Прошло время' } }, arcs: { heir: 20 }, secrets: { mole: 'hidden' }, time: 'Ночь 3' })
    const result = applyReviewDraft(base, base.sessionRecords[0], NOW)
    expect(result.clocks[0].value).toBe(1)
    expect(result.changes.map((change) => change.kind)).toEqual(['clock'])
    expect(result.storyArcs[0].progress).toBe(20)
  })

  it('applies with the review decisions in one write, and re-closing does not apply twice', () => {
    const base = campaign({ clocks: { tide: { delta: 1, reason: 'Итоги' } }, arcs: { heir: 50 }, secrets: {} })
    const once = completeReview(base, 's3', { target: 'none', now: NOW })
    expect(once.clocks[0].value).toBe(3)
    expect(once.storyArcs[0].progress).toBe(50)
    const reopened = { ...once, sessionRecords: once.sessionRecords.map((item) => ({ ...item, reviewStatus: 'draft' as const })) }
    const twice = completeReview(reopened, 's3', { target: 'none', now: NOW })
    expect(twice.clocks[0].value).toBe(3)
    expect(twice.sessionRecords[0].reviewApplied).toHaveLength(2)
  })

  it('keeps the draft through normalization and drops junk', () => {
    const base = normalizeCampaign({
      id: 'c', name: 'К', sessionRecords: [{ ...closed(), reviewDraft: { clocks: { a: { delta: 2, reason: 'x' }, b: { delta: 0 } }, arcs: { h: 140 }, secrets: { s: 'everyone', t: 'nope' }, time: 'Ночь' } }],
    }, NOW)!
    expect(base.sessionRecords[0].reviewDraft).toEqual({ clocks: { a: { delta: 2, reason: 'x' } }, arcs: { h: 100 }, secrets: { s: 'everyone' }, time: 'Ночь' })
  })
})
