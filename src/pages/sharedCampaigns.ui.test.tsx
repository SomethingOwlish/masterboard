// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { LocalCampaignCatalog } from '../local/catalog'
import type { CampaignCatalog } from '../local/remote'
import { readyCampaign, renderApp } from '../test/renderApp'

const OWNER = 'owl@example.com'

/** The browser catalog plus a stand-in for the Worker's shared access (the Worker itself is covered in worker/src). */
function withSharing(local: LocalCampaignCatalog, sharedIds: string[] = []): CampaignCatalog {
  const ids = new Set(sharedIds)
  return {
    ...local,
    shared: {
      email: OWNER,
      isShared: (id) => ids.has(id),
      async share(id) {
        const campaign = (await local.find(id))!
        const saved = await local.update({ ...campaign, masters: campaign.masters.map((master) => master.role === 'owner' ? { ...master, email: OWNER } : master) })
        ids.add(id)
        return saved
      },
    },
  }
}

beforeEach(() => window.localStorage.clear())

describe('shared campaigns', () => {
  it('shows who is signed in and moves a browser campaign to the server', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign()
    const shared = withSharing(catalog)
    renderApp('/', shared)
    expect(await screen.findByText(`Вход: ${OWNER}`)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Сделать общей: Город под стеклом' }))
    const card = (await screen.findByRole('link', { name: /Город под стеклом/ })).closest('article')!
    await waitFor(() => expect(within(card).getByText('Общая')).toBeInTheDocument())
    expect(shared.shared?.isShared(id)).toBe(true)
    expect((await catalog.find(id))?.masters[0].email).toBe(OWNER)
  })

  it('in a shared campaign the master comes from the sign-in and co-masters need an email', async () => {
    const user = userEvent.setup()
    const { catalog, id } = await readyCampaign({ masters: [{ id: 'm-owl', name: 'Сова', role: 'owner', email: OWNER }] })
    renderApp(`/local/campaign/${id}/team`, withSharing(catalog, [id]))
    expect(await screen.findByText('Общая кампания')).toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Добавить мастера' })
    await user.type(screen.getByLabelText('Имя нового мастера'), 'Лис')
    expect(add).toBeDisabled()
    await user.type(screen.getByLabelText('Почта нового мастера'), 'Fox@Example.com')
    await user.click(add)
    await waitFor(async () => expect((await catalog.find(id))?.masters.map((master) => master.email)).toEqual([OWNER, 'fox@example.com']))
    expect(screen.queryByLabelText('Кто работает в этом браузере')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Почта мастера Лис')).toHaveValue('fox@example.com')
  })
})
