import { Component, type ReactNode } from 'react'
import { Button } from '../../ds'

/** A lazily loaded chunk that is gone: the app was redeployed while this tab stayed open. */
const isStaleChunk = (error: Error) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Expected a JavaScript/i.test(error.message)

/**
 * Keeps a failing lazy view (the graphs) from taking the whole page down.
 * After a deploy the old chunk no longer exists, so it offers a reload —
 * unsent edits are kept in the browser and survive it.
 */
export class LazyBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = isStaleChunk(error)
    return <div className="session-plan__notice lazy-boundary" role="alert">
      <p>{stale ? 'Мастерборд обновился, пока страница была открыта, — эту часть нужно загрузить заново.' : `Не удалось показать граф: ${error.message}`}</p>
      <div className="row">{stale ? <Button variant="primary" icon="refresh-cw" onClick={() => window.location.reload()}>Обновить страницу</Button> : <Button icon="refresh-cw" onClick={() => this.setState({ error: null })}>Попробовать снова</Button>}</div>
    </div>
  }
}
