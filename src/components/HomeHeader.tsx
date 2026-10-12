import { Link } from 'react-router-dom'
import { Badge } from '../ds'
import { useLocalCatalog } from '../local/useLocalCampaign'
import { LocalThemeControl } from './LocalThemeControl'

/** The «М Мастерборд» lockup. DS `Logo` is the Latin wordmark, so the home pages keep this one. */
export function HomeBrand() {
  return <div className="campaign-workspace__brand">
    <span aria-hidden="true">М</span>
    <strong>Мастерборд</strong>
  </div>
}

/**
 * The bar above every page outside a campaign — Кампании, Игроки, Резервные
 * копии, Импорт (ТЗ-3, этап 10): logo (a link home), who is signed in, «Выйти», theme.
 */
export function HomeHeader() {
  const { shared } = useLocalCatalog()
  return <header className="campaign-workspace__topbar">
    <Link
      className="campaign-workspace__home"
      to="/"
      aria-label="Мастерборд — все кампании"
    >
      <HomeBrand />
    </Link>
    <div>
      {shared && <Badge tone="accent" dot>{shared.email}</Badge>}
      {shared && <a className="campaign-workspace__signout" href="/cdn-cgi/access/logout">Выйти</a>}
      <LocalThemeControl />
    </div>
  </header>
}
