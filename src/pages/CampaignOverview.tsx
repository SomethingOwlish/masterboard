// Campaign page (M2 / B2): the dashboard that greets you when you open a
// campaign. Header + next-session planner + recap log + party block + connected
// sites. Data comes from the open-campaign store, which the layout has loaded.

import { CampaignDetails } from '../components/CampaignDetails'
import { CharacterBlock } from '../components/CharacterBlock'
import { NextSessionPlanner } from '../components/NextSessionPlanner'
import { RecapLog } from '../components/RecapLog'
import { SourcePanel } from '../components/SourcePanel'
import { useCampaign } from '../store/campaign'

export function CampaignOverview() {
  const { campaign, recaps, characters, loading, notFound } = useCampaign()

  if (loading) return <div className="content"><p className="muted">Loading campaign…</p></div>
  if (notFound || !campaign) {
    return (
      <div className="content">
        <h1 style={{ marginTop: 0 }}>Campaign not found</h1>
        <p className="muted">It may have been deleted, or this device hasn't synced it yet.</p>
      </div>
    )
  }

  return (
    <div className="content campaign-overview">
      <CampaignDetails campaign={campaign} finishedCount={recaps.length} />

      <div className="overview-grid" style={{ marginTop: '1rem' }}>
        <div className="overview-col">
          <NextSessionPlanner plan={campaign.nextSession} />
          <CharacterBlock campaignId={campaign.id} characters={characters} />
          <SourcePanel campaignId={campaign.id} sites={campaign.settings.sourceSites} />
        </div>
        <div className="overview-col">
          <RecapLog recaps={recaps} />
        </div>
      </div>
    </div>
  )
}
