export type StoryEntityKind = 'character' | 'npc' | 'faction' | 'location'
export type StoryVisibility = 'public' | 'master'

export type StoryEntity = {
  id: string
  name: string
  kind: StoryEntityKind
  subtitle: string
  x: number
  y: number
}

export type StoryRelation = {
  id: string
  from: string
  to: string
  label: string
  visibility: StoryVisibility
}

export type StoryEvent = {
  id: string
  date: string
  title: string
  summary: string
  entityIds: string[]
  visibility: StoryVisibility
}

export type StoryMapSnapshot = {
  entities: StoryEntity[]
  relations: StoryRelation[]
  events: StoryEvent[]
}

const seed: StoryMapSnapshot = {
  entities: [
    { id: 'bryn', name: 'Брин Вейл', kind: 'character', subtitle: 'Следопыт · персонаж игрока', x: 11, y: 26 },
    { id: 'fox', name: 'Серебряный Лис', kind: 'npc', subtitle: 'Контрабандист · восточные ворота', x: 41, y: 12 },
    { id: 'guild', name: 'Гильдия фонарей', kind: 'faction', subtitle: 'Влиятельная фракция', x: 70, y: 27 },
    { id: 'port', name: 'Лунный порт', kind: 'location', subtitle: 'Город под красной луной', x: 24, y: 70 },
    { id: 'gate', name: 'Восточные ворота', kind: 'location', subtitle: 'Закрытый путь в город', x: 67, y: 72 },
  ],
  relations: [
    { id: 'r1', from: 'bryn', to: 'fox', label: 'должен услугу', visibility: 'master' },
    { id: 'r2', from: 'fox', to: 'guild', label: 'работает на', visibility: 'master' },
    { id: 'r3', from: 'guild', to: 'gate', label: 'контролирует', visibility: 'public' },
    { id: 'r4', from: 'bryn', to: 'port', label: 'ищет ответы', visibility: 'public' },
    { id: 'r5', from: 'fox', to: 'gate', label: 'знает тайный ход', visibility: 'master' },
    { id: 'r6', from: 'port', to: 'guild', label: 'боится', visibility: 'public' },
  ],
  events: [
    { id: 'e1', date: 'Ночь 1', title: 'Красная луна взошла', summary: 'Гавань закрылась до рассвета.', entityIds: ['port'], visibility: 'public' },
    { id: 'e2', date: 'Ночь 2', title: 'Лис перехватил письмо', summary: 'Имя Брина появилось в списке должников.', entityIds: ['fox', 'bryn'], visibility: 'master' },
    { id: 'e3', date: 'Ночь 3 · сейчас', title: 'Ворота запечатаны', summary: 'Гильдия требует плату за проход.', entityIds: ['guild', 'gate'], visibility: 'public' },
    { id: 'e4', date: 'Ночь 4', title: 'Аукцион теней', summary: 'Если герои опоздают, карта гавани будет продана.', entityIds: ['fox', 'guild'], visibility: 'master' },
  ],
}

const clone = (): StoryMapSnapshot => structuredClone(seed)

export function createLocalStoryMapDemo() {
  let state = clone()
  return {
    load: () => structuredClone(state),
    addRelation(input: Omit<StoryRelation, 'id'>) {
      if (input.from === input.to) throw new Error('Сущность нельзя связать саму с собой')
      if (!input.label.trim()) throw new Error('Укажите смысл связи')
      const id = `r-${state.relations.length + 1}`
      state.relations.push({ ...input, id, label: input.label.trim() })
      return structuredClone(state)
    },
    toggleRelationVisibility(id: string) {
      const relation = state.relations.find((item) => item.id === id)
      if (!relation) throw new Error('Связь не найдена')
      relation.visibility = relation.visibility === 'master' ? 'public' : 'master'
      return structuredClone(state)
    },
    reset() { state = clone(); return structuredClone(state) },
  }
}
