import { newArc, newClock, newEntity, newSecret } from './domain'
import type { LocalCampaignRecord } from './types'

const STAMP = '2026-09-01T12:00:00.000Z'

/** Example campaign created once on first launch so the workspace is not empty. */
export const MOON_PORT: LocalCampaignRecord = {
  id: 'moon-port',
  name: 'Лунный порт',
  idea: 'Город в гавани заключает сделки с красной луной.',
  activeTime: 'Третья ночь Фестиваля фонарей',
  masters: 'Сова + Лис',
  notes: ['Красный прилив поднимается каждую ночь фестиваля.', 'Гильдия фонарщиков хранит старый договор с луной.'],
  sessionRecords: [{
    id: 'session-moon-1', number: 1, title: 'Первая ночь в Лунном порту', status: 'draft', master: 'Сова', arcId: 'arc-moon-pact', backgroundArcIds: [],
    group: 'Основная партия', participants: '', inGameTime: 'Третья ночь фестиваля', timelinePosition: '',
    idea: 'Герои впервые сталкиваются с ценой договора порта.', focus: 'Провести героев через первую ночь фестиваля.',
    opening: 'Красный прилив доходит до лестниц с фонарями.', lines: '', layers: '', systems: '',
    planItems: [
      { id: 'plan-moon-stairs', source: 'text', text: 'Лестница фонарей уходит под воду', kind: 'scene', priority: 'required', status: 'prepared', role: '', alternative: '', note: 'Показать, что прилив неестественный.', origin: 'prepared' },
      { id: 'plan-moon-keeper', source: 'library', entityId: 'entity-moon-keeper', text: 'Смотритель Олан', kind: 'npc', priority: 'desired', status: 'prepared', role: '', alternative: '', note: 'Знает, где лежит договор.', origin: 'prepared' },
    ],
    flows: [], log: [], reviewNotes: '', reviewStatus: 'draft', reviewDecisions: {}, appliedDecisions: {}, createdAt: STAMP,
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
