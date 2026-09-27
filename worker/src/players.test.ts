import { beforeEach, describe, expect, it } from 'vitest'
import { handleApi, type Env } from './index'
import { testDb } from './testDb'

const OWL = 'owl@example.com'
const FOX = 'fox@example.com'
let env: Env
beforeEach(() => { env = { DB: testDb() } })

async function call(email: string, method: string, path: string, body?: unknown) {
  const response = await handleApi(new Request(`https://mb.test/api/${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }), { ...env, DEV_USER_EMAIL: email })
  return { status: response.status, body: response.status === 204 ? null : await response.json() as unknown }
}

describe('player directory (ТЗ-2, R11)', () => {
  it('shares profiles between masters and keeps each master’s note to themselves', async () => {
    expect(await call(OWL, 'PUT', 'players/ira', { data: { name: 'Ира', limits: 'пауки' }, expectedRevision: 0 })).toMatchObject({ status: 200, body: { id: 'ira', revision: 1, myNote: '' } })
    await call(OWL, 'PUT', 'players/ira/note', { text: 'Начинать с неё' })
    expect((await call(FOX, 'GET', 'players')).body).toEqual([{ id: 'ira', data: { id: 'ira', name: 'Ира', limits: 'пауки' }, revision: 1, updatedBy: OWL, myNote: '' }])
    expect((await call(OWL, 'GET', 'players')).body).toEqual([expect.objectContaining({ myNote: 'Начинать с неё' })])
  })

  it('refuses a stale write with the current profile and deletes a profile with its notes', async () => {
    await call(OWL, 'PUT', 'players/tim', { data: { name: 'Тим' }, expectedRevision: 0 })
    await call(FOX, 'PUT', 'players/tim', { data: { name: 'Тимофей' }, expectedRevision: 1 })
    expect(await call(OWL, 'PUT', 'players/tim', { data: { name: 'Тим К.' }, expectedRevision: 1 })).toMatchObject({ status: 409, body: { current: { revision: 2, data: { name: 'Тимофей' } } } })
    expect((await call(OWL, 'PUT', 'players/nobody/note', { text: 'x' })).status).toBe(404)
    expect((await call(OWL, 'DELETE', 'players/tim')).status).toBe(204)
    expect((await call(OWL, 'GET', 'players')).body).toEqual([])
    expect((await call(OWL, 'PUT', 'players/../x', { data: {} })).status).toBe(404)
  })
})
