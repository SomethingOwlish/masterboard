import { describe, expect, it } from 'vitest'
import { newSecret } from './domain'
import { blankSession, normalizeCampaign } from './normalize'
import { playerHandouts } from './printSheet'
import type { LocalSecretStatus } from './types'

const NOW = '2026-09-27T10:00:00.000Z'

describe('player handouts', () => {
  const session = { ...blankSession(1, 'Сова', NOW, 'session-1') }
  const secret = (id: string, status: LocalSecretStatus) => newSecret({ id, title: `Мастерское ${id}`, truth: `Правда ${id}`, publicVersion: `Игрокам ${id}`, status, sessionIds: ['session-1'] })
  const campaign = normalizeCampaign({ id: 'c1', name: 'Город', secrets: [secret('partial', 'partial'), secret('selected', 'selected'), secret('everyone', 'everyone'), secret('hidden', 'hidden')] }, NOW)!

  it('prints only the public wording of secrets revealed to the whole table', () => {
    const handouts = playerHandouts(campaign, session)
    expect(handouts.secrets).toEqual([{ id: 'partial', text: 'Игрокам partial' }, { id: 'everyone', text: 'Игрокам everyone' }])
    expect(JSON.stringify(handouts.secrets)).not.toContain('Мастерское')
  })
})
