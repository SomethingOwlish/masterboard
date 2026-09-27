import { useState } from 'react'
import { Button } from '../../ds'
import { applySessionImport, type SessionImportResult } from '../../local/sessionImport'
import type { LocalCampaignRecord } from '../../local/types'
import { logImport } from '../../local/imports'
import { SessionModal, type Persist } from './shared'

const RECORD_LABEL = { npc: 'NPC', material: 'Материал', secret: 'Секрет' } as const

/** Preview of a sessions file and «Импортировать»; used by the sessions rail and the «Импорт» section. */
export function SessionImportDialog({ campaign, persist, pending, close }: { campaign: LocalCampaignRecord; persist: Persist; pending: SessionImportResult | { error: string }; close: (firstSessionId?: string) => void }) {
  const [createRecords, setCreateRecords] = useState(true)
  const confirmImport = () => {
    if ('error' in pending) return
    persist(logImport(applySessionImport(campaign, pending, createRecords), 'Файл сессий', 'sessions', pending.sessions.length, new Date().toISOString()))
    close(pending.sessions[0].id)
  }
  return <SessionModal title="Импорт сессий" close={() => close()}>{'error' in pending ? <p className="session-plan__notice" role="alert">{pending.error}</p> : <div className="sessions-import-preview"><p>Будут созданы черновики:</p><ul>{pending.sessions.map((session) => <li key={session.id}><strong>№{session.number} {session.title}</strong> <small>{session.planItems.filter((item) => item.kind === 'scene').length} сцен · {session.planItems.length} пунктов плана · {session.flows.length} переходов</small></li>)}</ul>{pending.newRecords.length > 0 && <fieldset className="sessions-import-preview__records"><legend>Новые записи · {pending.newRecords.length}</legend><label><input type="checkbox" checked={createRecords} onChange={(event) => setCreateRecords(event.target.checked)} /> Создать в библиотеке и секретах</label><ul>{pending.newRecords.map((record) => <li key={`${record.kind}-${record.name}`}><small>{RECORD_LABEL[record.kind]}</small> {record.name}</li>)}</ul>{!createRecords && <p className="muted">Останутся текстом в плане — перенести можно потом кнопкой «В библиотеку».</p>}</fieldset>}{pending.warnings.length > 0 && <details open><summary>Замечания · {pending.warnings.length}</summary><ul>{pending.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}</div>}<footer><Button onClick={() => close()}>{'error' in pending ? 'Закрыть' : 'Отмена'}</Button>{!('error' in pending) && <Button variant="primary" icon="upload" onClick={confirmImport}>Импортировать · {pending.sessions.length}</Button>}</footer></SessionModal>
}
