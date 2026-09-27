// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LazyBoundary } from './LazyBoundary'

function Throws({ error }: { error: Error }): JSX.Element { throw error }

describe('LazyBoundary', () => {
  it('offers a reload when a chunk from an earlier deploy is gone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<LazyBoundary><Throws error={new TypeError('Failed to fetch dynamically imported module: /assets/PlanGraph-old.js')} /></LazyBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Мастерборд обновился')
    expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeInTheDocument()
  })

  it('shows any other error in place and lets the view retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = true
    function Flaky() { if (fail) throw new Error('узел без id'); return <p>граф</p> }
    render(<LazyBoundary><Flaky /></LazyBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось показать граф: узел без id')
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    expect(screen.getByText('граф')).toBeInTheDocument()
  })
})
