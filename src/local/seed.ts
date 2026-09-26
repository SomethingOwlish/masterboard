import { newArc, newClock, newEntity, newSecret } from './domain'
import type { LocalCampaignRecord } from './types'

const STAMP = '2026-09-01T12:00:00.000Z'

/** Example campaign created once on first launch so the workspace is not empty. */
export const MOON_PORT: LocalCampaignRecord = {
  id: 'moon-port',
  name: 'Лунный порт',
  idea: 'Город в гавани заключает сделки с красной луной.',
  activeTime: 'Третья ночь Фестиваля фонарей',
  masters: [{ id: 'master-owl', name: 'Сова', role: 'owner' }, { id: 'master-fox', name: 'Лис', role: 'co-master' }],
  players: [
    { id: 'player-ira', name: 'Ира', characterIds: [], note: '' },
    { id: 'player-tim', name: 'Тим', characterIds: [], note: '' },
    { id: 'player-lena', name: 'Лена', characterIds: [], note: 'Играет в другой группе, иногда заходит в гости' },
  ],
  groups: [{ id: 'group-main', name: 'Основная партия', playerIds: ['player-ira', 'player-tim'] }],
  archived: false,
  improv: [
    { id: 'improv-name-1', masterId: 'master-owl', kind: 'name', text: 'Мирта Солеварка' },
    { id: 'improv-complication-1', masterId: 'master-owl', kind: 'complication', text: 'Фонари гаснут все разом' },
  ],
  dashboardLayouts: {},
  publications: [],
  integrations: {},
  notes: ['Красный прилив поднимается каждую ночь фестиваля.', 'Гильдия фонарщиков хранит старый договор с луной.'],
  sessionRecords: [{
    id: 'session-moon-1', number: 1, title: 'Первая ночь в Лунном порту', status: 'draft', masterId: 'master-owl', handovers: [], arcId: 'arc-moon-pact', backgroundArcIds: [],
    groupId: 'group-main', guestPlayerIds: [], participants: '', date: '', inGameTime: 'Третья ночь фестиваля', timelinePosition: '',
    idea: 'Герои впервые сталкиваются с ценой договора порта.', focus: 'Провести героев через первую ночь фестиваля.',
    opening: 'Красный прилив доходит до лестниц с фонарями.', lines: '', layers: '', systems: '',
    planItems: [
      { id: 'plan-moon-stairs', source: 'text', text: 'Лестница фонарей уходит под воду', kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: 'Показать, что прилив неестественный.', origin: 'prepared' },
      { id: 'plan-moon-keeper', source: 'library', entityId: 'entity-moon-keeper', text: 'Смотритель Олан', kind: 'npc', priority: 'desired', status: 'prepared', role: '', alternative: '', note: 'Знает, где лежит договор.', origin: 'prepared' },
    ],
    flows: [], log: [], reviewNotes: '', reviewStatus: 'draft', reviewDecisions: {}, appliedDecisions: {}, planLayout: {}, printConfig: { priorities: ['required', 'desired', 'useful', 'backup'], passport: true, entities: true, secrets: true, clocks: true, flows: true, notes: true }, createdAt: STAMP,
  }],
  activeSessionId: 'session-moon-1',
  entities: [
    newEntity({ id: 'entity-moon-keeper', type: 'npc', name: 'Смотритель Олан', description: 'Старый фонарщик, помнит прошлую сделку.', tags: ['гильдия'], fields: { motive: 'Не дать гильдии повторить ошибку' } }),
    newEntity({ id: 'entity-moon-harbor', type: 'location', name: 'Гавань фонарей', description: 'Причалы, где идёт фестиваль.', tags: ['порт'], visibility: 'public', fields: { mood: 'Шум праздника и запах соли' } }),
  ],
  relations: [{ id: 'relation-moon-keeper', fromId: 'entity-moon-keeper', toId: 'entity-moon-harbor', label: 'охраняет', type: 'belongs', direction: 'directed', visibility: 'public' }],
  storyArcs: [newArc({ id: 'arc-moon-pact', title: 'Договор с красной луной', direction: 'Луна требует новую плату', stakes: 'Порт уйдёт под воду', status: 'active', progress: 20, owner: 'Сова' })],
  clocks: [newClock({ id: 'clock-moon-tide', title: 'Красный прилив', value: 1, trigger: 'Нижний город затоплен', advanceCondition: 'Каждая ночь без нового договора', arcId: 'arc-moon-pact', thresholds: [{ id: 'threshold-moon-stairs', at: 3, consequence: 'Лестницы фонарей скрываются под водой' }] })],
  secrets: [newSecret({ id: 'secret-moon-price', title: 'Цена договора', truth: 'Луна забирает имена горожан.', publicVersion: 'Договор требует жертвы.', revealCondition: 'Герои найдут текст договора', entityIds: ['entity-moon-keeper'], clockIds: ['clock-moon-tide'] })],
  tasks: [],
  inbox: [],
  relationLayout: {},
  createdAt: STAMP,
  updatedAt: STAMP,
}
