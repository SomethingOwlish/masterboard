// Reusable image input (B7). A preview + a file picker that uploads through the
// configured ImageAdapter (Imgur) and writes the resulting URL back. Used by every
// image field — character/NPC portraits, location images, campaign covers.
//
// When no Imgur client ID is configured the upload button still appears but
// explains the gap, and a manual URL input is offered as a fallback so the GM is
// never locked out of setting an image.

import { useRef, useState } from 'react'
import { useConfig } from '../store/config'
import { Icon, Button } from '../ds'

type Variant = 'avatar' | 'thumb' | 'cover'

const PREVIEW_CLASS: Record<Variant, string> = {
  avatar: 'avatar',
  thumb: 'loc-thumb',
  cover: 'overview-cover',
}
const EMPTY_CLASS: Record<Variant, string> = {
  avatar: 'avatar avatar-empty',
  thumb: 'loc-thumb loc-thumb-empty',
  cover: 'overview-cover overview-cover-empty',
}

export function ImageField({
  value,
  onChange,
  variant = 'thumb',
  glyph = 'image',
}: {
  value?: string
  onChange: (url: string | undefined) => void
  variant?: Variant
  /** Lucide icon name shown in the empty preview tile. */
  glyph?: string
}) {
  const imageAdapter = useConfig((s) => s.imageAdapter)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adapter = imageAdapter()

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after a failure
    if (!file) return
    if (!adapter) {
      setError('Add an Imgur client ID in Settings to upload images.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const url = await adapter.upload(file)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="image-field">
      <div className="image-field-row">
        {value ? (
          <img className={PREVIEW_CLASS[variant]} src={value} alt="" />
        ) : (
          <span className={EMPTY_CLASS[variant]} aria-hidden>
            <Icon name={glyph} size={variant === 'avatar' ? 18 : 28} />
          </span>
        )}

        <div className="image-field-actions">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            style={{ display: 'none' }}
          />
          <Button size="sm" icon="upload" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace…' : 'Upload…'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(undefined)} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Manual URL only matters when uploads are unavailable; configured GMs get
          the clean picker-only experience they asked for. */}
      {!adapter && (
        <input
          className="image-field-url"
          value={value ?? ''}
          placeholder="…or paste an image URL"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}

      {error && <p className="image-field-error">{error}</p>}
    </div>
  )
}
