// Rules store (M11 / B9). rules.md is a single raw-markdown file per campaign
// (not JSON). Edits update state immediately and persist on a short debounce so a
// burst of typing becomes one write — the repository then debounces the GitHub
// push on top of that. No per-keystroke activity log (matches the campaign store's
// treatment of free-text fields); a coarse "Edited rules" is logged once a quiet
// edit settles.

import { create } from 'zustand'
import { data } from '../storage/data'
import { useActivity } from './activity'

const SAVE_DEBOUNCE_MS = 800

interface RulesState {
  campaignId: string | null
  markdown: string
  loading: boolean
  saving: boolean

  load: (campaignId: string) => Promise<void>
  setMarkdown: (markdown: string) => void
  /** Force any pending debounced write to flush now (e.g. before navigating away). */
  flush: () => Promise<void>
}

let timer: ReturnType<typeof setTimeout> | null = null
let dirtySinceLog = false

export const useRules = create<RulesState>((set, get) => {
  async function persist(): Promise<void> {
    const { campaignId, markdown } = get()
    if (!campaignId) return
    set({ saving: true })
    await data.writeRules(campaignId, markdown)
    set({ saving: false })
    if (dirtySinceLog) {
      dirtySinceLog = false
      void useActivity.getState().log(campaignId, 'Edited rules')
    }
  }

  return {
    campaignId: null,
    markdown: '',
    loading: false,
    saving: false,

    load: async (campaignId) => {
      if (get().campaignId === campaignId && !get().loading) return
      set({ loading: true, campaignId, markdown: '' })
      const markdown = await data.readRules(campaignId)
      if (get().campaignId === campaignId) set({ markdown, loading: false })
    },

    setMarkdown: (markdown) => {
      set({ markdown })
      dirtySinceLog = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void persist()
      }, SAVE_DEBOUNCE_MS)
    },

    flush: async () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      await persist()
    },
  }
})
