import { Navigate, useParams } from 'react-router-dom'
import { LocalCampaignControlCenter } from '../components/LocalCampaignControlCenter'
import { LocalSessionsWorkspace } from '../components/LocalSessionsWorkspace'
import { ArcsSection } from '../components/local/ArcsSection'
import { LibrarySection } from '../components/local/LibrarySection'
import { OnboardingRoom } from '../components/local/OnboardingRoom'
import { OverviewSection } from '../components/local/OverviewSection'
import { PrintSection } from '../components/local/PrintSection'
import { TeamSection } from '../components/local/TeamSection'
import { ImprovSection } from '../components/local/ImprovSection'
import { PublishSection } from '../components/local/PublishSection'
import { ActingProvider } from '../local/ActingProvider'
import { RelationsSection } from '../components/local/RelationsSection'
import { WorldSection } from '../components/local/WorldSection'
import { CampaignHeader, KNOWN_SECTIONS, SaveErrorBanner, type SectionProps } from '../components/local/shared'
import { isCampaignReady } from '../local/normalize'
import { useLocalCampaign } from '../local/useLocalCampaign'

const SECTIONS: Record<string, (props: SectionProps) => JSX.Element> = {
  overview: OverviewSection,
  arcs: ArcsSection,
  control: LocalCampaignControlCenter,
  library: LibrarySection,
  map: RelationsSection,
  world: WorldSection,
  print: PrintSection,
  team: TeamSection,
  improv: ImprovSection,
  publish: PublishSection,
}

export function LocalNewCampaignPage() {
  const { campaignId = '', section = 'overview' } = useParams()
  const state = useLocalCampaign(campaignId)
  if (state.status === 'loading') return <main className="target-dashboard created-dashboard" aria-busy="true"><p className="local-session-footnote">Загружаем кампанию…</p></main>
  if (state.status === 'missing') return <Navigate to="/" replace />
  if (!KNOWN_SECTIONS.has(section)) return <Navigate to={`/local/campaign/${campaignId}/overview`} replace />
  const { campaign, persist, saveError, retry } = state
  const banner = <SaveErrorBanner message={saveError} retry={retry} />
  if (!isCampaignReady(campaign)) return <>{banner}<OnboardingRoom campaign={campaign} persist={persist} /></>
  const Section = SECTIONS[section]
  return <ActingProvider key={campaign.id} campaign={campaign}>
    {section === 'session' || section === 'play' || section === 'review'
      ? <>{banner}<LocalSessionsWorkspace campaign={campaign} persist={persist} mode={section === 'play' ? 'play' : section === 'review' ? 'review' : 'plan'} /></>
      : <main className="target-dashboard created-dashboard">
        <CampaignHeader campaign={campaign} section={section} />
        {banner}
        <Section campaign={campaign} persist={persist} />
      </main>}
  </ActingProvider>
}
