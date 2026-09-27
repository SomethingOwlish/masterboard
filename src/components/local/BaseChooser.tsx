import { ROLE_HINT, ROLE_LABEL, SYSTEM_LABEL, type BaseChoice, type BaseOption, type CampaignRole } from '../../local/integration'
import { useBaseOptions } from '../../local/useExternal'

const ROLES: CampaignRole[] = ['world', 'table', 'system']

/**
 * «Основа» in the new-campaign dialog (ТЗ-2, R1): a world, a table and a system,
 * any of them or several. Each row is a switch and a choice of the record.
 */
export function BaseChooser({ value, onChange }: { value: BaseChoice; onChange: (next: BaseChoice) => void }) {
  const base = useBaseOptions()
  const key = (option: BaseOption) => `${option.system}:${option.externalId}`
  return <fieldset className="base-chooser"><legend>Основа <small>— можно несколько или ни одной</small></legend>
    {base.status === 'loading' && <p className="muted" role="status">Узнаём, что вам доступно…</p>}
    {(base.status === 'unconfigured' || base.status === 'error') && <p className="muted" role="status">{base.status === 'unconfigured' ? 'Интеграции не настроены на сервере — кампания создастся с нуля.' : `Системы не ответили (${base.message}). Кампания создастся с нуля, основу можно подключить позже.`}</p>}
    {base.status === 'ready' && ROLES.map((role) => {
      const options = base.options[role]
      const chosen = value[role]
      const on = Boolean(chosen)
      return <div key={role} className={`base-chooser__row${on ? ' on' : ''}`}>
        <label className="base-chooser__switch"><input type="checkbox" disabled={!options.length} checked={on} onChange={() => onChange({ ...value, [role]: on ? undefined : options[0] })} /><span><strong>{ROLE_LABEL[role]}</strong><small>{options.length ? ROLE_HINT[role] : 'Нет доступных записей'}</small></span></label>
        <select aria-label={`Основа: ${ROLE_LABEL[role]}`} disabled={!on} value={chosen ? key(chosen) : ''} onChange={(event) => onChange({ ...value, [role]: options.find((option) => key(option) === event.target.value) })}>
          {!on && <option value="">—</option>}
          {options.map((option) => <option key={key(option)} value={key(option)}>{role === 'table' ? `${SYSTEM_LABEL[option.system]} · ` : ''}{option.label}</option>)}
        </select>
      </div>
    })}
  </fieldset>
}
