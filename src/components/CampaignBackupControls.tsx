import { useRef } from 'react'
import { Button } from '../ds'
import { localCampaignCatalog } from '../fixtures/localCampaignCatalog'
import { useToast } from './useToast'

export function CampaignBackupControls({ onRestore, damaged = false }: { onRestore: () => void; damaged?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const download = () => {
    try {
      const content = damaged ? localCampaignCatalog.exportRaw() : localCampaignCatalog.exportBackup()
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `masterboard-${damaged ? 'recovery' : 'backup'}-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { toast({ tone: 'danger', message: String(error), duration: 0 }) }
  }
  return <div className="row" style={{ flexWrap: 'wrap' }}>
    <Button icon="download" onClick={download}>{damaged ? 'Скачать повреждённый каталог' : 'Резервная копия'}</Button>
    <Button icon="upload" onClick={() => input.current?.click()}>Восстановить из файла</Button>
    <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Резервная копия кампаний" onChange={async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      try {
        const count = localCampaignCatalog.importBackup(await file.text())
        onRestore()
        toast({ tone: 'success', message: `Восстановлено кампаний: ${count}. Добавлены отдельные копии.` })
      } catch (error) { toast({ tone: 'danger', message: `Не удалось восстановить: ${String(error)}`, duration: 0 }) }
    }} />
  </div>
}
