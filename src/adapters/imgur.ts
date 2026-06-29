// Imgur ImageAdapter (B7). Anonymous client-ID uploads: the GM pastes an Imgur
// application's Client-ID in Settings and images go to Imgur's CDN (public/
// unlisted), returning a stable URL we store as the entity's ImgRef. It sits
// behind the ImageAdapter interface so a repo-asset backend can replace it later
// without touching any feature code (DESIGN.md §7).

import type { ImageAdapter } from './types'

interface ImgurError {
  data?: { error?: string | { message?: string } }
}

export class ImgurImageAdapter implements ImageAdapter {
  constructor(private clientId: string) {}

  async upload(file: File | Blob): Promise<string> {
    const form = new FormData()
    form.append('image', file)

    const res = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { Authorization: `Client-ID ${this.clientId}` },
      body: form,
    })

    if (!res.ok) {
      throw new Error(`Imgur upload failed: ${await this.detail(res)}`)
    }
    const body = (await res.json()) as { data?: { link?: string } }
    if (!body.data?.link) throw new Error('Imgur upload failed: no link returned.')
    return body.data.link
  }

  // Imgur error bodies carry a human-readable reason (bad client ID, rate limit,
  // file too large). Surface it so a failed upload is diagnosable.
  private async detail(res: Response): Promise<string> {
    try {
      const body = (await res.json()) as ImgurError
      const err = body.data?.error
      const msg = typeof err === 'string' ? err : err?.message
      return msg ? `${res.status} ${msg}` : `${res.status} ${res.statusText}`
    } catch {
      return `${res.status} ${res.statusText}`
    }
  }
}
