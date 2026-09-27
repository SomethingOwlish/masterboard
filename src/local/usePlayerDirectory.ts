import { useCallback, useEffect, useState } from 'react'
import { PlayersConflictError, type PlayerEntry, type PlayerProfile } from './players'
import { usePlayersGateway } from './playersContext'

export type DirectoryState = { status: 'loading' } | { status: 'ready'; entries: PlayerEntry[] } | { status: 'error'; message: string }

/** The shared player directory for one screen: read once, then kept in step with every write. */
export function usePlayerDirectory() {
  const gateway = usePlayersGateway()
  const [state, setState] = useState<DirectoryState>({ status: 'loading' })
  const [notice, setNotice] = useState<string | null>(null)
  const reload = useCallback(() => gateway.list().then((entries) => setState({ status: 'ready', entries: entries.sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'ru')) }), (error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Справочник не ответил' })), [gateway])
  useEffect(() => { void reload() }, [reload])
  const put = (entry: PlayerEntry) => setState((current) => current.status === 'ready' ? { status: 'ready', entries: [...current.entries.filter((item) => item.profile.id !== entry.profile.id), entry].sort((a, b) => a.profile.name.localeCompare(b.profile.name, 'ru')) } : current)
  const save = async (profile: PlayerProfile, revision: number) => {
    try { const entry = await gateway.save(profile, revision); put(entry); setNotice(null); return entry } catch (error) {
      if (error instanceof PlayersConflictError) { if (error.current) put(error.current); setNotice(error.message); return null }
      setNotice(error instanceof Error ? error.message : 'Не сохранилось'); return null
    }
  }
  const note = async (id: string, text: string) => { try { put(await gateway.note(id, text)) } catch (error) { setNotice(error instanceof Error ? error.message : 'Не сохранилось') } }
  const remove = async (id: string) => { await gateway.remove(id); setState((current) => current.status === 'ready' ? { status: 'ready', entries: current.entries.filter((item) => item.profile.id !== id) } : current) }
  return { state, notice, save, note, remove, reload }
}
