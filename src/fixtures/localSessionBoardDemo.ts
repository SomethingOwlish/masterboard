export type BoardItemKind = 'character' | 'npc' | 'location' | 'event' | 'misc'

export interface BoardItem {
  id: string
  name: string
  kind: BoardItemKind
  detail: string
  tags: string[]
}

export interface BoardScene {
  id: string
  title: string
  purpose: string
  beat: string
  itemIds: string[]
}

export interface LocalSessionBoardSnapshot {
  scenes: BoardScene[]
  items: BoardItem[]
  ready: boolean
  revision: number
}

const ITEMS: BoardItem[] = [
  { id: 'bryn', name: 'Bryn Vale', kind: 'character', detail: 'Sees impossible coastlines', tags: ['party'] },
  { id: 'fox', name: 'The Silver Fox', kind: 'npc', detail: 'Offers the stolen tide chart', tags: ['informant', 'rival'] },
  { id: 'captain', name: 'Captain Orra', kind: 'npc', detail: 'Blocks the eastern gate', tags: ['watch'] },
  { id: 'port', name: 'Moon Port', kind: 'location', detail: 'Tidal stairs and brass lanterns', tags: ['harbor'] },
  { id: 'gate', name: 'Eastern Gate', kind: 'location', detail: 'Opens only at red tide', tags: ['locked'] },
  { id: 'tide', name: 'The red tide arrives', kind: 'event', detail: 'Festival night three · midnight', tags: ['clock'] },
  { id: 'chart', name: 'Old tide chart', kind: 'misc', detail: 'Shows the harbor moving', tags: ['clue'] },
]

const SCENES: BoardScene[] = [
  { id: 'arrival', title: 'Lantern stairs', purpose: 'Establish the impossible tide', beat: 'The stairs disappear beneath red water.', itemIds: ['bryn', 'port', 'tide'] },
  { id: 'bargain', title: "The Fox's bargain", purpose: 'Offer a risky path forward', beat: 'The Fox trades the chart for a future favor.', itemIds: ['fox', 'chart'] },
  { id: 'gate', title: 'Eastern gate', purpose: 'Force the first campaign choice', beat: 'Captain Orra asks who authorized the party.', itemIds: ['captain', 'gate'] },
]

function clone(snapshot: LocalSessionBoardSnapshot): LocalSessionBoardSnapshot {
  return structuredClone(snapshot)
}

export function createLocalSessionBoardDemo() {
  let snapshot: LocalSessionBoardSnapshot = { scenes: clone({ scenes: SCENES, items: [], ready: false, revision: 0 }).scenes, items: structuredClone(ITEMS), ready: false, revision: 0 }

  const read = () => clone(snapshot)
  const commit = (scenes: BoardScene[], ready = snapshot.ready) => {
    snapshot = { ...snapshot, scenes, ready, revision: snapshot.revision + 1 }
    return read()
  }

  return {
    read,
    moveItem(itemId: string, sceneId: string) {
      if (!snapshot.items.some((item) => item.id === itemId)) throw new Error('Unknown board item')
      if (!snapshot.scenes.some((scene) => scene.id === sceneId)) throw new Error('Unknown scene')
      return commit(snapshot.scenes.map((scene) => ({
        ...scene,
        itemIds: scene.id === sceneId
          ? [...scene.itemIds.filter((id) => id !== itemId), itemId]
          : scene.itemIds.filter((id) => id !== itemId),
      })))
    },
    addItem(itemId: string, sceneId: string) {
      return this.moveItem(itemId, sceneId)
    },
    reorderScene(sceneId: string, direction: -1 | 1) {
      const index = snapshot.scenes.findIndex((scene) => scene.id === sceneId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= snapshot.scenes.length) return read()
      const scenes = [...snapshot.scenes]
      ;[scenes[index], scenes[target]] = [scenes[target], scenes[index]]
      return commit(scenes)
    },
    toggleReady() {
      return commit(snapshot.scenes, !snapshot.ready)
    },
  }
}
