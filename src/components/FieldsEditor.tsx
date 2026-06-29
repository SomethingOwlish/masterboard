// Reusable custom-field engine (DESIGN.md M3/M4). Renders an editable list of
// GM-defined fields — label + type + value — with add/remove. Shared by Characters
// and NPCs now, Misc later.

import { makeField } from '../model/defaults'
import type { Field } from '../model/types'

const TYPES: Field['type'][] = ['text', 'number', 'longtext']

export function FieldsEditor({ fields, onChange }: { fields: Field[]; onChange: (fields: Field[]) => void }) {
  function patch(id: string, p: Partial<Field>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...p } : f)))
  }

  return (
    <div className="fields-editor">
      {fields.map((f) => (
        <div key={f.id} className="field-row">
          <div className="field-row-head">
            <input
              value={f.label}
              placeholder="Field label"
              onChange={(e) => patch(f.id, { label: e.target.value })}
              style={{ flex: 1 }}
            />
            <select value={f.type} onChange={(e) => patch(f.id, { type: e.target.value as Field['type'] })}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="ghost" aria-label="Remove field" onClick={() => onChange(fields.filter((x) => x.id !== f.id))}>
              🗑
            </button>
          </div>
          {f.type === 'longtext' ? (
            <textarea rows={3} value={f.value} onChange={(e) => patch(f.id, { value: e.target.value })} />
          ) : (
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              value={f.value}
              onChange={(e) => patch(f.id, { value: e.target.value })}
            />
          )}
        </div>
      ))}
      <button onClick={() => onChange([...fields, makeField()])}>+ Add field</button>
    </div>
  )
}
