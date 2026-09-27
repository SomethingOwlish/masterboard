/**
 * Резервная копия (этап М5). Копию делает lorebridge: ночью, после укладки
 * индекса, кладёт все общие кампании в приватный репозиторий бэкапа, папкой
 * `мастерборд/`, по файлу на кампанию в формате «Экспорта». Masterboard только
 * показывает итог и просит копию сейчас.
 */
export interface BackupRun {
  /** ISO-время окончания. */
  at: string
  state: 'записано' | 'без изменений' | 'ошибка'
  campaigns: number
  files: number
  error?: string
  /** «ночь» или почта того, кто нажал. */
  повод: string
}

export interface BackupStatus {
  /** У моста есть и GitHub, и дорога к Masterboard. */
  configured: boolean
  /** Папка копий в GitHub. */
  folder?: string
  schedule: string
  last: BackupRun | null
}

export const backupStateLabel: Record<BackupRun['state'], string> = {
  'записано': 'Копия записана',
  'без изменений': 'Без изменений с прошлой копии',
  'ошибка': 'Копия не прошла',
}

/** Кто запустил: ночь — расписание, иначе почта мастера. */
export const backupCause = (run: BackupRun) => (run.повод === 'ночь' ? 'по расписанию' : `вручную: ${run.повод}`)
