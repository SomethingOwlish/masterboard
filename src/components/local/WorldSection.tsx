import { LibrarySection } from './LibrarySection'
import type { SectionProps } from './shared'

/** «Заметки» (ТЗ-3, этап 14, В4): the library filtered to notes, with a quick field. */
export function WorldSection(props: SectionProps) {
  return <LibrarySection {...props} notes />
}
