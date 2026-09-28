import { Button, Icon } from '../ds'
import { useDocumentTitle } from '../components/useDocumentTitle'

/**
 * Shown when nobody is signed in (decision F1: all of Masterboard is behind
 * sign-in). In production Cloudflare Access puts its own email-code page in
 * front of the app, so people land here only if that step did not happen.
 */
export function SignInPage() {
  useDocumentTitle('Вход')
  return <main className="sign-in">
    <section className="sign-in__card" aria-labelledby="sign-in-title">
      <div className="campaign-workspace__brand"><span>М</span><strong>Мастерборд</strong></div>
      <h1 id="sign-in-title">Вход</h1>
      <p>Кампании, сессии и библиотека открываются после входа по почте. Мы пришлём код на ваш адрес — пароль не нужен.</p>
      <Button variant="primary" icon="arrow-right" onClick={() => window.location.reload()}>Войти по почте</Button>
      {import.meta.env.DEV && <p className="sign-in__dev"><Icon name="info" size={15} /> Разработка: запустите <code>npm run worker:dev</code> — Vite проксирует <code>/api</code> на него, вход подставляется из <code>DEV_USER_EMAIL</code>.</p>}
    </section>
  </main>
}
