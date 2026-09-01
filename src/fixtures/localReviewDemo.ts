export type ReviewDecision = 'unresolved' | 'carry-forward' | 'task' | 'resolved'
export interface ReviewFact { id: string; kind: 'consequence' | 'secret' | 'clock' | 'npc'; text: string; decision?: ReviewDecision }
export interface LocalReviewSnapshot { facts: ReviewFact[]; notes: string; completed: boolean; completedAt?: string }

const FACTS: ReviewFact[] = [
  { id: 'favor', kind: 'consequence', text: 'The party owes the Silver Fox an unnamed favor.' },
  { id: 'harbor', kind: 'secret', text: 'Bryn learned the harbor is a sleeping creature.' },
  { id: 'clock', kind: 'clock', text: 'The harbor wakes advanced to 4/6.' },
  { id: 'orra', kind: 'npc', text: 'Captain Orra recognized Bryn at the eastern gate.' },
]

export function createLocalReviewDemo() {
  const state: LocalReviewSnapshot = { facts: structuredClone(FACTS), notes: '', completed: false }
  const read = () => structuredClone(state)
  const requireOpen = () => { if (state.completed) throw new Error('Review is already complete') }
  return {
    read,
    decide(id: string, decision: ReviewDecision) { requireOpen(); const fact = state.facts.find((item) => item.id === id); if (!fact) throw new Error('Unknown review fact'); fact.decision = decision; return read() },
    saveNotes(notes: string) { requireOpen(); state.notes = notes.trim(); return read() },
    complete() { requireOpen(); if (state.facts.some((fact) => !fact.decision)) throw new Error('Every fact needs a decision'); state.completed = true; state.completedAt = '2026-09-01T21:15:00.000Z'; return read() },
    reopen() { state.completed = false; state.completedAt = undefined; return read() },
  }
}
