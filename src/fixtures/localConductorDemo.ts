export type ConductorLogKind = 'scene' | 'clock' | 'secret' | 'note' | 'consequence'

export interface ConductorLogEntry { id: number; at: string; kind: ConductorLogKind; text: string }
export interface ConductorScene { id: string; title: string; purpose: string; prompt: string; cast: string[] }
export interface ConductorSnapshot {
  scenes: ConductorScene[]
  currentScene: number
  clock: { title: string; value: number; max: number }
  secret: { title: string; truth: string; revealed: boolean }
  log: ConductorLogEntry[]
  status: 'running' | 'paused' | 'closed'
  elapsedMinutes: number
}

const SCENES: ConductorScene[] = [
  { id: 'arrival', title: 'Lantern stairs', purpose: 'Establish the impossible tide', prompt: 'What does Bryn notice that nobody else can see?', cast: ['Bryn Vale', 'Moon Port', 'Red tide'] },
  { id: 'bargain', title: "The Fox's bargain", purpose: 'Offer a risky path forward', prompt: 'What favor will feel harmless now and costly later?', cast: ['The Silver Fox', 'Old tide chart'] },
  { id: 'gate', title: 'Eastern gate', purpose: 'Force the first campaign choice', prompt: 'Who does Captain Orra recognize?', cast: ['Captain Orra', 'Eastern Gate'] },
]

function copy(state: ConductorSnapshot) { return structuredClone(state) }

export function createLocalConductorDemo() {
  let id = 1
  const state: ConductorSnapshot = {
    scenes: structuredClone(SCENES), currentScene: 0,
    clock: { title: 'The harbor wakes', value: 3, max: 6 },
    secret: { title: 'The harbor is a sleeping creature', truth: 'The city is built on its shell.', revealed: false },
    log: [{ id: id++, at: '20:00', kind: 'scene', text: 'Session started at Lantern stairs' }],
    status: 'running', elapsedMinutes: 0,
  }
  const read = () => copy(state)
  const requireOpen = () => { if (state.status === 'closed') throw new Error('Session is already closed') }
  const append = (kind: ConductorLogKind, text: string) => {
    state.log = [...state.log, { id: id++, at: `20:${String(state.log.length * 4).padStart(2, '0')}`, kind, text }]
  }
  return {
    read,
    addLog(kind: ConductorLogKind, text: string) { requireOpen(); if (!text.trim()) throw new Error('Log text is required'); append(kind, text.trim()); return read() },
    advanceScene() {
      requireOpen()
      if (state.currentScene >= state.scenes.length - 1) return read()
      state.currentScene += 1; state.elapsedMinutes += 25
      append('scene', `Moved to ${state.scenes[state.currentScene].title}`)
      return read()
    },
    tickClock(delta: -1 | 1) {
      requireOpen()
      const next = Math.max(0, Math.min(state.clock.max, state.clock.value + delta))
      if (next !== state.clock.value) { state.clock.value = next; append('clock', `${state.clock.title}: ${next}/${state.clock.max}`) }
      return read()
    },
    revealSecret() { requireOpen(); if (!state.secret.revealed) { state.secret.revealed = true; append('secret', `Revealed: ${state.secret.title}`) } return read() },
    togglePause() { requireOpen(); state.status = state.status === 'paused' ? 'running' : 'paused'; return read() },
    close() { requireOpen(); state.status = 'closed'; append('consequence', 'Session closed — review is ready'); return read() },
  }
}
