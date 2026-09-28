import { useState } from 'react'
import { Button, Select } from '../../../ds'
import { moveItemTo } from '../../../local/plan'
import type { LocalSessionPlanItem, LocalSessionPlanKind } from '../../../local/types'
import { SessionModal } from '../shared'
import type { PlanApi } from './planApi'
import { PLAN_KINDS, PRIORITIES } from '../../../local/labels'

type Item = LocalSessionPlanItem

/**
 * Edits one plan item or scene in one place: title, type, priority, note, role,
 * «or» group and scene. A library record or a secret keeps its own name — it is
 * edited in the library (or the secrets), the plan only links to it.
 */
export function PlanItemEditor({ api, item, close }: { api: PlanApi; item: Item; close: () => void }) {
  const [draft, setDraft] = useState<Item>(item)
  const isScene = item.kind === 'scene'
  const linked = Boolean(item.entityId || item.secretId)
  const scenes = api.session.planItems.filter((entry) => entry.kind === 'scene' && entry.id !== item.id)
  const set = (patch: Partial<Item>) => setDraft({ ...draft, ...patch })
  const title = linked ? api.itemTitle(item) : draft.text
  const save = () => {
    if (!linked && !draft.text.trim()) return
    const next: Item = { ...draft, text: linked ? item.text : draft.text.trim(), note: draft.note.trim(), role: draft.role.trim(), alternative: draft.alternative.trim() }
    const patched = { ...api.session, planItems: api.session.planItems.map((entry) => entry.id === item.id ? { ...next, sceneId: item.sceneId } : entry) }
    api.update(next.sceneId !== item.sceneId ? moveItemTo(patched, item.id, { sceneId: next.sceneId ?? null }) : patched)
    close()
  }
  return <SessionModal title={isScene ? 'Сцена' : 'Пункт плана'} close={close} draft={draft}>
    <form className="session-passport-form plan-item-editor" onSubmit={(event) => { event.preventDefault(); save() }}>
      <label>Название{linked
        ? <span className="plan-item-editor__linked"><input value={title} disabled aria-describedby="plan-item-linked-hint" /><small id="plan-item-linked-hint">{item.secretId ? 'Название секрета меняется в «Пульт → Секреты».' : 'Название записи меняется в библиотеке.'}</small></span>
        : <input autoFocus value={draft.text} onChange={(event) => set({ text: event.target.value })} />}
      </label>
      {item.entityId && <Button type="button" size="sm" icon="pencil" onClick={() => { close(); api.editEntity(item.entityId!) }}>Редактировать запись</Button>}
      <div className="control-form__row">
        {!isScene && <label>Тип<Select value={draft.kind} onChange={(event) => set({ kind: event.target.value as LocalSessionPlanKind })}>{PLAN_KINDS.filter(([value]) => value !== 'scene').map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></label>}
        <label>Приоритет<Select value={draft.priority} onChange={(event) => set({ priority: event.target.value as Item['priority'] })}>{PRIORITIES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</Select></label>
        {!isScene && <label>Сцена<Select value={draft.sceneId && scenes.some((scene) => scene.id === draft.sceneId) ? draft.sceneId : ''} onChange={(event) => set({ sceneId: event.target.value || undefined })}><option value="">Вне сцен</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{api.itemTitle(scene)}</option>)}</Select></label>}
      </div>
      <label>{isScene ? 'Комментарий к сцене' : 'Заметка'}<textarea rows={3} value={draft.note} placeholder={isScene ? 'Условие входа, настроение, что должно случиться…' : 'Заметка для этой сессии: условие, реплика…'} onChange={(event) => set({ note: event.target.value })} /></label>
      <div className="control-form__row">
        {!isScene && <label>Роль в сессии<input value={draft.role} placeholder="Проводник, помеха, свидетель…" onChange={(event) => set({ role: event.target.value })} /></label>}
        <label>Группа «или-или»<input value={draft.alternative} list={`alt-groups-${api.session.id}`} placeholder="Например «вход в порт»" onChange={(event) => set({ alternative: event.target.value })} /></label>
      </div>
      <footer><Button type="button" onClick={close}>Отмена</Button><Button type="submit" variant="primary" icon="check" disabled={!linked && !draft.text.trim()}>Сохранить</Button></footer>
    </form>
  </SessionModal>
}
