import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, Icon } from '../ds'
import { useDocumentTitle } from '../components/useDocumentTitle'
import { HomeBrand } from '../components/HomeHeader'
import type { CampaignCatalog, CatalogState } from '../local/remote'

/** The card the app shows before any campaign page: sign-in, loading, server unreachable. */
function GateCard({ titleId, busy, children }: { titleId?: string; busy?: boolean; children: ReactNode }) {
  return <main className="sign-in" aria-busy={busy || undefined}>
    <section
      className="sign-in__card"
      aria-labelledby={titleId}
    >
      <HomeBrand />
      {children}
    </section>
  </main>
}

/**
 * Shown when nobody is signed in (decision F1: all of Masterboard is behind
 * sign-in). In production Cloudflare Access puts its own email-code page in
 * front of the app, so people land here only if that step did not happen.
 */
export function SignInPage() {
  useDocumentTitle('Вход')
  return <GateCard titleId="sign-in-title">
    <h1 id="sign-in-title">Вход</h1>
    <p>Кампании, сессии и библиотека открываются после входа по почте. Мы пришлём код на ваш адрес — пароль не нужен.</p>
    <Button
      variant="primary"
      icon="arrow-right"
      onClick={() => window.location.reload()}
    >
      Войти по почте
    </Button>
    {import.meta.env.DEV && (
      <p className="sign-in__dev">
        <Icon name="info" size={15} />
        <span>
          Разработка: запустите <code>npm run worker:dev</code> — Vite проксирует <code>/api</code> на него, вход
          подставляется из <code>DEV_USER_EMAIL</code>.
        </span>
      </p>
    )}
  </GateCard>
}

/** The server did not answer or failed: not the same as «войдите» (ТЗ-3, этап 10). */
export function ServerUnreachablePage({ retry, retrying = false }: { retry: () => void; retrying?: boolean }) {
  useDocumentTitle('Нет связи')
  return <GateCard titleId="unreachable-title">
    <h1 id="unreachable-title">Не удалось связаться с сервером</h1>
    <p role="alert">
      Сервер Мастерборда не ответил. Проверьте интернет и попробуйте ещё раз — ваши кампании на сервере не пострадали.
    </p>
    <Button
      variant="primary"
      icon="refresh-cw"
      disabled={retrying}
      onClick={retry}
    >
      {retrying ? 'Подключаемся…' : 'Повторить'}
    </Button>
    {import.meta.env.DEV && (
      <p className="sign-in__dev">
        <Icon name="info" size={15} />
        <span>Разработка: Worker не отвечает — запустите <code>npm run worker:dev</code>.</span>
      </p>
    )}
  </GateCard>
}

/**
 * Asks the server who is signed in, then renders the app, the sign-in page or
 * «сервер недоступен · Повторить». While it asks — a loading card, not a blank page.
 */
export function Boot({ resolve, children }: { resolve: () => Promise<CatalogState>; children: (catalog: CampaignCatalog) => ReactNode }) {
  const [state, setState] = useState<CatalogState | null>(null)
  const [retrying, setRetrying] = useState(false)
  const ask = useCallback(() => {
    void resolve().then(setState, () => setState({ status: 'unreachable' })).finally(() => setRetrying(false))
  }, [resolve])
  useEffect(ask, [ask])
  if (!state) return <BootLoading />
  if (state.status === 'ready') return <>{children(state.catalog)}</>
  if (state.status === 'signed-out') return <SignInPage />
  return <ServerUnreachablePage
    retrying={retrying}
    retry={() => { setRetrying(true); ask() }}
  />
}

function BootLoading() {
  useDocumentTitle('Загрузка')
  return <GateCard busy>
    <p role="status">Подключаемся к серверу…</p>
  </GateCard>
}
